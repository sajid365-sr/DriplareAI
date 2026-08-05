import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { AUTO_TRAIN_FEE } from "@/lib/domain/credit-config";
import {
  fetchFacebookConversations,
  fetchFacebookConversationMessages,
} from "@/lib/services/facebook";
import {
  parseConversationsToDrafts,
  buildTranscriptsFromChatMessages,
  type ConversationTranscript,
} from "@/lib/ai/auto-train";

type Selection = { platform: string; count: number };

type FBMessage = {
  id: string;
  message?: string;
  from?: { name: string; id: string };
  created_time: string;
};

const FB_PLATFORMS = ["facebook", "n8n_facebook"];
const DB_PLATFORMS = ["whatsapp", "instagram"];
const KNOWN_PLATFORMS = [...FB_PLATFORMS, ...DB_PLATFORMS];

/** Turns raw FB conversation messages into a single "Customer:/Owner:" transcript. */
function buildFBTranscript(messages: FBMessage[], pageId: string): string {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
  );

  const lines: string[] = [];
  for (const msg of sorted) {
    if (!msg.message || !msg.from) continue;
    const speaker = msg.from.id === pageId ? "Owner" : "Customer";
    lines.push(`${speaker}: ${msg.message}`);
  }

  return lines.join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }
    const chatbotId = bot.chatbotId;

    // Validate selections
    const body = (await req.json()) as { selections?: Selection[] };
    const rawSelections = Array.isArray(body.selections) ? body.selections : [];

    const selections = rawSelections
      .filter((s) => s && KNOWN_PLATFORMS.includes(s.platform))
      .map((s) => ({
        platform: s.platform,
        count: Math.min(100, Math.max(1, Math.floor(Number(s.count) || 25))),
      }));

    if (selections.length === 0) {
      return NextResponse.json(
        { error: "Select at least one connected platform to train from." },
        { status: 400 }
      );
    }

    // Credit check — flat fee per run
    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.creditsBalance < AUTO_TRAIN_FEE) {
      return NextResponse.json(
        {
          error: "Insufficient credits. Please upgrade.",
          code: "INSUFFICIENT_CREDITS",
          credits_required: AUTO_TRAIN_FEE,
          credits_balance: user.creditsBalance,
        },
        { status: 402 }
      );
    }

    // Gather transcripts per selected platform
    const transcripts: ConversationTranscript[] = [];

    for (const sel of selections) {
      try {
        if (FB_PLATFORMS.includes(sel.platform)) {
          await gatherFacebookTranscripts(chatbotId, sel.count, transcripts);
        } else {
          await gatherDBTranscripts(chatbotId, sel.platform, sel.count, transcripts);
        }
      } catch (err) {
        console.error(`[AUTO_TRAIN_GATHER_ERROR] ${sel.platform}:`, err);
      }
    }

    // No conversations → don't charge, return empty with warning
    if (transcripts.length === 0) {
      return NextResponse.json({
        drafts: { faqs: [], sampleReplies: [], content: [] },
        warning: "no_conversations",
        meta: { transcriptCount: 0, creditsSpent: 0 },
      });
    }

    // Parse with AI
    const drafts = await parseConversationsToDrafts(transcripts);

    // Deduct credits + log transaction
    await db.$transaction([
      db.user.update({
        where: { userId },
        data: {
          creditsBalance: { decrement: AUTO_TRAIN_FEE },
          creditsUsedThisCycle: { increment: AUTO_TRAIN_FEE },
        },
      }),
      db.creditTransaction.create({
        data: {
          userId,
          chatbotId,
          action_type: "auto_train",
          model_tier: null,
          credits_spent: AUTO_TRAIN_FEE,
          metadata: {
            platforms: selections.map((s) => s.platform),
            transcriptCount: transcripts.length,
          },
        },
      }),
    ]);

    return NextResponse.json({
      drafts,
      meta: { transcriptCount: transcripts.length, creditsSpent: AUTO_TRAIN_FEE },
    });
  } catch (error) {
    console.error("[AUTO_TRAIN_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/** Facebook: live Graph API fetch of recent conversations → transcripts. */
async function gatherFacebookTranscripts(
  chatbotId: string,
  count: number,
  out: ConversationTranscript[]
) {
  const integration = await db.integration.findFirst({
    where: {
      chatbotId,
      platform: { in: FB_PLATFORMS },
      connected: true,
    },
  });

  if (!integration || !integration.config) return;

  const config = integration.config as Record<string, unknown>;
  const pageId = config.pageId as string | undefined;
  const pageToken = config.pageToken as string | undefined;

  if (!pageId || !pageToken) return;

  const convRes = await fetchFacebookConversations(pageId, pageToken);
  const conversations = (convRes.data || []).slice(0, count);

  for (const conv of conversations) {
    try {
      const messagesRes = await fetchFacebookConversationMessages(conv.id, pageToken);
      const fbMessages = (messagesRes.data || []) as FBMessage[];
      const text = buildFBTranscript(fbMessages, pageId);
      if (!text.trim()) continue;

      const participant = conv.participants?.data?.find(
        (p: { id: string; name: string }) => p.id !== pageId
      );
      out.push({
        platform: "facebook",
        label: participant?.name || `Facebook chat ${conv.id.slice(-6)}`,
        text,
      });
    } catch (err) {
      console.error(`[AUTO_TRAIN_FB_CONV] ${conv.id}:`, err);
    }
  }
}

/** WhatsApp/Instagram: read webhook-stored ChatSession + ChatMessage rows. */
async function gatherDBTranscripts(
  chatbotId: string,
  platform: string,
  count: number,
  out: ConversationTranscript[]
) {
  const sessions = await db.chatSession.findMany({
    where: { chatbotId, platform },
    take: count,
    orderBy: { updatedAt: "desc" },
    select: { sessionId: true, platform: true, guestName: true },
  });

  if (sessions.length === 0) return;

  const messages = await db.chatMessage.findMany({
    where: {
      chatbotId,
      sessionId: { in: sessions.map((s) => s.sessionId) },
    },
    select: { sessionId: true, role: true, content: true, sentByHuman: true, timestamp: true },
  });

  const messagesBySession = new Map<string, typeof messages>();
  for (const msg of messages) {
    const list = messagesBySession.get(msg.sessionId) || [];
    list.push(msg);
    messagesBySession.set(msg.sessionId, list);
  }

  const transcripts = buildTranscriptsFromChatMessages(sessions, messagesBySession);
  out.push(...transcripts);
}
