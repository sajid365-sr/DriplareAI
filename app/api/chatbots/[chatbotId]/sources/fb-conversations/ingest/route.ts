import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { db } from "@/lib/core/db";
import { fetchFacebookConversationMessages, FacebookGraphApiError } from "@/lib/services/facebook";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";

type QAPair = {
  question: string;
  answer: string;
};

type FBMessage = {
  id: string;
  message?: string;
  from?: {
    name: string;
    id: string;
  };
  created_time: string;
};

function buildQAPairsFromFB(messages: FBMessage[], pageId: string): QAPair[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
  );

  const pairs: QAPair[] = [];
  let currentQuestion = "";

  for (const msg of sorted) {
    if (!msg.message || !msg.from) continue;

    const isFromPage = msg.from.id === pageId;

    if (!isFromPage) {
      if (currentQuestion) {
        currentQuestion += " " + msg.message;
      } else {
        currentQuestion = msg.message;
      }
    } else {
      if (currentQuestion) {
        pairs.push({
          question: currentQuestion.trim(),
          answer: msg.message.trim(),
        });
        currentQuestion = "";
      }
    }
  }

  return pairs;
}

function qaPairsToText(pairs: QAPair[]): string {
  return pairs
    .map(
      (pair, i) =>
        `[Conversation ${i + 1}]\nCustomer: ${pair.question}\nOwner: ${pair.answer}`
    )
    .join("\n\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Find connected facebook integration
    const integration = await db.integration.findFirst({
      where: {
        chatbotId,
        platform: { in: ["facebook", "n8n_facebook"] },
        connected: true,
      },
    });

    if (!integration || !integration.config) {
      return NextResponse.json(
        { error: "Facebook integration not connected or active." },
        { status: 400 }
      );
    }

    const config = integration.config as Record<string, any>;
    const pageId = config.pageId;
    const pageToken = config.pageToken;

    if (!pageId || !pageToken) {
      return NextResponse.json(
        { error: "Facebook Page credentials missing in integration config." },
        { status: 400 }
      );
    }

    const { conversations } = (await req.json()) as {
      conversations: Array<{ id: string; label: string }>;
    };

    if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json(
        { error: "No conversations provided for ingestion." },
        { status: 400 }
      );
    }

    let successCount = 0;
    let totalPairsCount = 0;

    for (const conv of conversations) {
      try {
        const messagesRes = await fetchFacebookConversationMessages(conv.id, pageToken);
        const fbMessages = (messagesRes.data || []) as FBMessage[];

        const qaPairs = buildQAPairsFromFB(fbMessages, pageId);

        if (qaPairs.length === 0) {
          console.warn(`[FB_INGEST] No valid Q&A pairs found in conversation ${conv.id}`);
          continue;
        }

        const trainingText = qaPairsToText(qaPairs);

        // Create source and train model
        await createSourceWithEmbeddings({
          chatbotId,
          type: "text",
          name: `[Facebook Chat] ${conv.id} - ${conv.label} (${qaPairs.length} messages)`,
          content: trainingText,
        });

        successCount++;
        totalPairsCount += qaPairs.length;
      } catch (err) {
        console.error(`[FB_INGEST_CONVERSATION_FAILED] ${conv.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      conversationsProcessed: successCount,
      pairsIngested: totalPairsCount,
    });
  } catch (error) {
    console.error("[FB_INGEST_ROUTE_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
