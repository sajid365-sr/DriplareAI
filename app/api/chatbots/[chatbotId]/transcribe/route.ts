import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/core/db";
import { transcribeAudio, inferAudioFormat } from "@/lib/ai/transcription";

const transcribeSchema = z.object({
  audioUrl: z.string().url().optional(),
  audioBase64: z.string().min(10).optional(),
  mimeType: z.string().optional(),
  format: z.enum(["wav", "mp3", "ogg", "webm", "m4a"]).optional(),
  languageHint: z.string().max(20).optional(),
}).refine((data) => data.audioUrl || data.audioBase64, {
  message: "Either audioUrl or audioBase64 must be provided",
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId } = await params;
    const authHeader = req.headers.get("authorization");
    const internalSecret = process.env.CRON_SECRET || process.env.API_Key;

    let isAuthorized = false;

    // 1. Allow internal services (e.g. n8n workflows or webhooks) with bearer secret
    if (authHeader && internalSecret) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token === internalSecret) {
        isAuthorized = true;
      }
    }

    // 2. Otherwise verify Clerk user session & bot ownership
    if (!isAuthorized) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const bot = await db.chatbot.findFirst({
        where: { chatbotId, userId },
        select: { chatbotId: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
      }
      isAuthorized = true;
    }

    const body = await req.json();
    const validation = transcribeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { audioUrl, audioBase64, mimeType, format, languageHint } = validation.data;

    const result = await transcribeAudio({
      audioUrl,
      audioBase64,
      mimeType,
      format: format || inferAudioFormat(mimeType || audioUrl),
      languageHint,
    });

    return NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
    });
  } catch (error) {
    console.error("[TRANSCRIBE_ROUTE_ERROR]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal transcription error",
      },
      { status: 500 }
    );
  }
}
