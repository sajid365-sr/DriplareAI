import "server-only";

import { callModel } from "@/lib/ai/gateway";
import { matchEvidence, redactConversationPersonalData, type AutoTrainEvidence } from "@/lib/ai/auto-train-evidence";

/**
 * Auto-Train Engine — AI-powered draft generation from social conversations.
 * Fetches FB/WhatsApp/Instagram chats → parses with OpenRouter → returns structured drafts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoTrainDrafts = {
  faqs: Array<{ question: string; answer: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  sampleReplies: Array<{ customerMessage: string; reply: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  content: Array<{ title: string; content: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  runId?: string;
};

export type ConversationTranscript = {
  platform: string;
  label: string;
  text: string;
  sourceId?: string;
  agentName?: string;
};

type ChatSessionWithMessages = {
  sessionId: string;
  platform: string;
  guestName: string | null;
};

type ChatMessageRow = {
  role: string;
  content: string;
  sentByHuman: boolean;
  timestamp: Date;
};

// ─── Build Transcripts from DB Messages (WhatsApp/Instagram) ─────────────────

/**
 * Converts stored ChatSession + ChatMessage rows into conversation transcripts.
 * For WhatsApp/Instagram (no live history API) — reads webhook-stored messages.
 */
export function buildTranscriptsFromChatMessages(
  sessions: ChatSessionWithMessages[],
  messagesBySession: Map<string, ChatMessageRow[]>
): ConversationTranscript[] {
  const transcripts: ConversationTranscript[] = [];

  for (const session of sessions) {
    const messages = messagesBySession.get(session.sessionId) || [];
    if (messages.length === 0) continue;

    // Sort by timestamp ascending
    const sorted = [...messages].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Build conversation text: "Customer: ... / Owner: ..."
    const lines: string[] = [];
    for (const msg of sorted) {
      const speaker = msg.sentByHuman ? "Owner" : msg.role === "assistant" ? "AI Agent" : "Customer";
      lines.push(`${speaker}: ${redactConversationPersonalData(msg.content)}`);
    }

    const label = `${session.platform} conversation ${session.sessionId.slice(-6)}`;

    transcripts.push({
      platform: session.platform,
      label,
      text: lines.join("\n"),
    });
  }

  return transcripts;
}

// ─── Parse Conversations to Drafts with OpenRouter ───────────────────────────

const MAX_CORPUS_CHARS = 40000; // Cap total input to ~10k tokens
const MODEL = "google/gemini-2.5-flash"; // Standard tier, cheap, JSON-capable

/**
 * Sends conversation transcripts to an AI model via OpenRouter, which extracts:
 * - Recurring customer questions → FAQs
 * - Representative owner replies → sample replies (tone)
 * - Durable business facts → content chunks
 *
 * Returns structured drafts (empty arrays on failure, never throws).
 */
export async function parseConversationsToDrafts(
  transcripts: ConversationTranscript[],
  /**
   * Who owns the call. Optional only so existing callers keep compiling — pass
   * it wherever it is known, because without an owner the quota gate has no
   * balance to read and the usage row has nobody to attribute the cost to.
   */
  meta?: { userId?: string; chatbotId?: string; workspaceId?: string; requireEvidence?: boolean; throwOnFailure?: boolean }
): Promise<AutoTrainDrafts> {
  if (transcripts.length === 0) {
    return { faqs: [], sampleReplies: [], content: [] };
  }

  // Join transcripts into one corpus, cap total size
  let corpus = transcripts
    .map((t) => `[${t.sourceId ? `${t.sourceId} | ` : ""}${t.agentName ? `${t.agentName} | ` : ""}${t.platform} - ${t.label}]\n${t.text}`)
    .join("\n\n");
  if (corpus.length > MAX_CORPUS_CHARS) {
    corpus = corpus.slice(0, MAX_CORPUS_CHARS);
  }

  const systemPrompt = `You are an expert business analyst. Read the following customer service conversations and extract:

1. **FAQs**: Recurring customer questions and answers supported by the conversations. Deduplicate similar questions. Return up to 15.
2. **Sample Replies**: Representative customer situations and human-owner replies (not AI Agent replies). Return up to 10.
3. **Content**: Durable business facts explicitly stated by the customer-service owner. Return up to 8 concise reference notes.

Every suggestion MUST include one short, exact, verbatim quote from the supplied conversations as evidence.quote. Do not invent, paraphrase, or add ellipses to evidence. Omit a suggestion if there is no direct supporting quote. Copy platform, label, and agentName from the conversation heading.
Reply in the same language as the customer where possible.

Return ONLY valid JSON in this exact structure:
{
  "faqs": [{"question": "...", "answer": "...", "evidence": {"quote": "...", "platform": "...", "label": "...", "agentName": "..."}}],
  "sampleReplies": [{"customerMessage": "...", "reply": "...", "evidence": {"quote": "...", "platform": "...", "label": "...", "agentName": "..."}}],
  "content": [{"title": "...", "content": "...", "evidence": {"quote": "...", "platform": "...", "label": "...", "agentName": "..."}}]
}`;

  try {
    const { text: raw } = await callModel({
      task: "auto_train",
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: corpus },
      ],
      json: true,
      temperature: 0.3,
      userId: meta?.userId,
      chatbotId: meta?.chatbotId,
      workspaceId: meta?.workspaceId,
    });

    return parseAndCleanDrafts(raw, transcripts, meta?.requireEvidence ?? false, meta?.throwOnFailure ?? false);
  } catch (err) {
    console.error("[AUTO_TRAIN_PARSE_ERROR]", err);
    if (meta?.throwOnFailure) throw err;
    return { faqs: [], sampleReplies: [], content: [] };
  }
}

/**
 * Defensive JSON parse: strip code fences, clamp array sizes, trim/drop empties.
 */
function parseAndCleanDrafts(
  raw: string,
  transcripts: ConversationTranscript[],
  requireEvidence: boolean,
  throwOnFailure: boolean
): AutoTrainDrafts {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned) as Partial<AutoTrainDrafts>;

    // Clamp and clean each array
    const faqs = (parsed.faqs || [])
      .filter((f) => f?.question?.trim() && f?.answer?.trim())
      .slice(0, 20)
      .flatMap((f) => {
        const evidence = matchEvidence(f.evidence, transcripts);
        if (evidence) return [{ question: f.question.trim(), answer: f.answer.trim(), evidence }];
        return requireEvidence ? [] : [{ question: f.question.trim(), answer: f.answer.trim() }];
      });

    const sampleReplies = (parsed.sampleReplies || [])
      .filter((s) => s?.customerMessage?.trim() && s?.reply?.trim())
      .slice(0, 15)
      .flatMap((s) => {
        const evidence = matchEvidence(s.evidence, transcripts);
        if (evidence) return [{ customerMessage: s.customerMessage.trim(), reply: s.reply.trim(), evidence }];
        return requireEvidence ? [] : [{ customerMessage: s.customerMessage.trim(), reply: s.reply.trim() }];
      });

    const content = (parsed.content || [])
      .filter((c) => c?.title?.trim() && c?.content?.trim())
      .slice(0, 12)
      .flatMap((c) => {
        const evidence = matchEvidence(c.evidence, transcripts);
        if (evidence) return [{ title: c.title.trim().slice(0, 200), content: c.content.trim(), evidence }];
        return requireEvidence ? [] : [{ title: c.title.trim().slice(0, 200), content: c.content.trim() }];
      });

    return { faqs, sampleReplies, content };
  } catch (err) {
    console.error("[AUTO_TRAIN_PARSE_JSON_ERROR]", err);
    if (throwOnFailure) throw err;
    return { faqs: [], sampleReplies: [], content: [] };
  }
}
