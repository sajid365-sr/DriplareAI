import "server-only";

import { openRouter } from "@/lib/ai/embeddings";

/**
 * Auto-Train Engine — AI-powered draft generation from social conversations.
 * Fetches FB/WhatsApp/Instagram chats → parses with OpenRouter → returns structured drafts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoTrainDrafts = {
  faqs: Array<{ question: string; answer: string }>;
  sampleReplies: Array<{ customerMessage: string; reply: string }>;
  content: Array<{ title: string; content: string }>;
};

export type ConversationTranscript = {
  platform: string;
  label: string;
  text: string;
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
      // role !== "assistant" → Customer; else Owner
      const speaker = msg.role !== "assistant" ? "Customer" : "Owner";
      lines.push(`${speaker}: ${msg.content}`);
    }

    const label =
      session.guestName || `${session.platform} conversation ${session.sessionId.slice(-6)}`;

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
  transcripts: ConversationTranscript[]
): Promise<AutoTrainDrafts> {
  if (transcripts.length === 0) {
    return { faqs: [], sampleReplies: [], content: [] };
  }

  // Join transcripts into one corpus, cap total size
  let corpus = transcripts.map((t) => `[${t.platform} - ${t.label}]\n${t.text}`).join("\n\n");
  if (corpus.length > MAX_CORPUS_CHARS) {
    corpus = corpus.slice(0, MAX_CORPUS_CHARS);
  }

  const systemPrompt = `You are an expert business analyst. Read the following customer service conversations and extract:

1. **FAQs**: Recurring customer questions and their correct answers. Deduplicate similar questions. Return 5-15 FAQs.
2. **Sample Replies**: Representative examples of how the business replies to customers. Capture the tone, style, and typical phrasing. Return 5-10 sample replies.
3. **Content Training**: Durable business facts (hours, policies, product info, shipping details, etc.) that aren't conversational but should train the AI. Return 3-8 content chunks, each with a descriptive title.

Reply in the **same language the customers used** (Bengali if customers spoke Bengali, English if they spoke English, etc.).

Return ONLY valid JSON in this exact structure:
{
  "faqs": [{"question": "...", "answer": "..."}],
  "sampleReplies": [{"customerMessage": "...", "reply": "..."}],
  "content": [{"title": "...", "content": "..."}]
}`;

  try {
    const response = await openRouter.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: corpus },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content || "";
    const parsed = parseAndCleanDrafts(raw);
    return parsed;
  } catch (err) {
    console.error("[AUTO_TRAIN_PARSE_ERROR]", err);
    return { faqs: [], sampleReplies: [], content: [] };
  }
}

/**
 * Defensive JSON parse: strip code fences, clamp array sizes, trim/drop empties.
 */
function parseAndCleanDrafts(raw: string): AutoTrainDrafts {
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
      .map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
      }));

    const sampleReplies = (parsed.sampleReplies || [])
      .filter((s) => s?.customerMessage?.trim() && s?.reply?.trim())
      .slice(0, 15)
      .map((s) => ({
        customerMessage: s.customerMessage.trim(),
        reply: s.reply.trim(),
      }));

    const content = (parsed.content || [])
      .filter((c) => c?.title?.trim() && c?.content?.trim())
      .slice(0, 12)
      .map((c) => ({
        title: c.title.trim().slice(0, 200),
        content: c.content.trim(),
      }));

    return { faqs, sampleReplies, content };
  } catch (err) {
    console.error("[AUTO_TRAIN_PARSE_JSON_ERROR]", err);
    return { faqs: [], sampleReplies: [], content: [] };
  }
}
