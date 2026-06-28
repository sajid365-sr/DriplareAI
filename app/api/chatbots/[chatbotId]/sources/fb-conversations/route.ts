import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { db } from "@/lib/core/db";
import { fetchFacebookConversations, FacebookGraphApiError } from "@/lib/services/facebook";

const FB_CHAT_PREFIX = "[Facebook Chat]";

/** Parse ingested FB conversation IDs from source names */
function parseIngestedInfo(sources: { name: string }[]): { ids: string[]; labels: string[] } {
  const ids: string[] = [];
  const labels: string[] = [];
  for (const src of sources) {
    // New format: [Facebook Chat] {convId} - {label} ({count} messages)
    const idMatch = src.name.match(new RegExp(`^${FB_CHAT_PREFIX} ([^-]+) - `));
    if (idMatch) ids.push(idMatch[1].trim());

    // Extract label from either format
    const labelMatch = src.name.match(new RegExp(`^${FB_CHAT_PREFIX} (.+) \\(\\d+ messages\\)$`));
    if (labelMatch) labels.push(labelMatch[1].trim().replace(/^[^-]+ - /, ""));
  }
  return { ids, labels };
}

/** Check if a FB conversation is already ingested by ID or participant name */
function isIngested(
  conv: any,
  ingestedIds: string[],
  ingestedLabels: string[]
): boolean {
  if (ingestedIds.includes(conv.id)) return true;

  // Fallback: match by participant name for older sources without convId
  const parts = Array.isArray(conv.participants)
    ? conv.participants
    : conv.participants?.data || [];
  const name = parts.map((p: any) => p.name).filter(Boolean).join(", ") || "";
  return name.length > 0 && ingestedLabels.some((l) => l.includes(name) || name.includes(l));
}

/** Build ingested conversation objects from source records */
function buildIngestedConversations(sources: { name: string; content: string | null; charCount: number }[]) {
  return sources.map((src) => {
    const match = src.name.match(new RegExp(`^${FB_CHAT_PREFIX} ([^-]+) - (.+) \\((\\d+) messages\\)$`));
    const label = match?.[2] || src.name.replace(FB_CHAT_PREFIX, "").trim();
    const messageCount = match ? parseInt(match[3]) : 0;
    const snippet = src.content
      ? src.content.split("\n").slice(0, 2).join(" ").slice(0, 120)
      : "";

    return {
      id: match?.[1]?.trim() || src.name,
      label,
      message_count: messageCount,
      snippet,
      ingested: true,
    };
  });
}

export async function GET(
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

    // Always fetch already-ingested sources first
    const ingestedSources = await db.source.findMany({
      where: {
        chatbotId,
        name: { startsWith: FB_CHAT_PREFIX },
      },
      select: { name: true, content: true, charCount: true },
    });

    const { ids: ingestedIds, labels: ingestedLabels } = parseIngestedInfo(ingestedSources);

    // Check if fresh fetch from Facebook is requested
    const url = new URL(req.url);
    const fresh = url.searchParams.get("fresh") === "true";

    if (!fresh) {
      // Default: return only already-ingested conversations
      return NextResponse.json({
        conversations: buildIngestedConversations(ingestedSources),
        ingestedIds,
        fresh: false,
      });
    }

    // Fresh fetch from Facebook API
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

    try {
      const conversationsResponse = await fetchFacebookConversations(pageId, pageToken);
      const fbConversations = (conversationsResponse.data || []).map((conv: any) => ({
        ...conv,
        ingested: isIngested(conv, ingestedIds, ingestedLabels),
      }));

      return NextResponse.json({
        conversations: fbConversations,
        ingestedIds,
        fresh: true,
      });
    } catch (fbError) {
      console.error("[FB_CONVERSATIONS_GRAPH_API_ERROR]", fbError);
      if (fbError instanceof FacebookGraphApiError) {
        return NextResponse.json(
          { error: fbError.message, code: fbError.code, subcode: fbError.subcode },
          { status: fbError.status || 400 }
        );
      }
      return NextResponse.json(
        { error: "Facebook Graph API failed to retrieve conversations." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[FB_CONVERSATIONS_ROUTE_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
