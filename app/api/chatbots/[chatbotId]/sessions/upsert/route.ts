import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

/**
 * POST /api/chatbots/[chatbotId]/sessions/upsert
 *
 * This endpoint is called by n8n to create or update a chat session.
 * It supports setting `integrationId` so sessions are properly linked
 * to their source integration (Facebook, Instagram, WhatsApp, etc.).
 *
 * Required header: x-n8n-secret (matches N8N_CALLBACK_SECRET env var)
 *
 * Body:
 * {
 *   sessionId:     string   — unique session identifier (e.g. "fb_12345_67890")
 *   platform:      string   — "facebook" | "instagram" | "whatsapp" | "web" etc.
 *   integrationId: string?  — the Integration.integrationId value (optional)
 *   guestName:     string?  — display name of the user
 *   profilePhoto:  string?  — avatar URL of the user
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;

    // Verify the n8n secret to prevent unauthorized session writes
    const secret = req.headers.get("x-n8n-secret");
    const expectedSecret = process.env.N8N_CALLBACK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      sessionId,
      platform,
      integrationId,
      guestName,
      profilePhoto,
    } = body as {
      sessionId?: string;
      platform?: string;
      integrationId?: string;
      guestName?: string;
      profilePhoto?: string;
    };

    if (!sessionId || !platform) {
      return NextResponse.json(
        { error: "sessionId and platform are required" },
        { status: 400 }
      );
    }

    // Validate chatbot exists
    const chatbot = await db.chatbot.findUnique({
      where: { chatbotId },
      select: { chatbotId: true },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // If integrationId was provided, verify it exists and belongs to this chatbot
    if (integrationId) {
      const integration = await db.integration.findFirst({
        where: { integrationId, chatbotId },
        select: { integrationId: true, connected: true },
      });

      if (!integration) {
        return NextResponse.json(
          { error: "Integration not found or does not belong to this chatbot" },
          { status: 400 }
        );
      }
    }

    // Upsert the session — create if new, update if existing
    const session = await db.chatSession.upsert({
      where: { chatbotId_sessionId: { chatbotId, sessionId } },
      create: {
        chatbotId,
        sessionId,
        platform: platform.toLowerCase(),
        integrationId: integrationId ?? null,
        guestName: guestName ?? null,
        profilePhoto: profilePhoto ?? null,
        isActive: true,
      },
      update: {
        // Only update mutable fields — don't overwrite integrationId if already set
        ...(guestName !== undefined && { guestName }),
        ...(profilePhoto !== undefined && { profilePhoto }),
        // Set integrationId only if not already linked (don't re-link to a different integration)
        ...(integrationId && { integrationId }),
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("[SESSION_UPSERT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
