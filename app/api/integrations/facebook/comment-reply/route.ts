import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/core/db";

const commentReplySchema = z.object({
  integrationId: z.string().min(1),
  enabled: z.boolean(),
  mode: z.enum(["ai", "fixed"]),
  fixedMessage: z.string().max(500).optional().default(""),
  sendPrivateDM: z.boolean().optional().default(false),
});

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = commentReplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { integrationId, enabled, mode, fixedMessage, sendPrivateDM } = parsed.data;

    // Verify the integration belongs to this user
    const integration = await db.integration.findFirst({
      where: {
        integrationId,
        chatbot: { userId },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    // Merge commentReply into existing config without overwriting other fields
    const existingConfig = (integration.config as Record<string, unknown>) ?? {};
    const updatedConfig = {
      ...existingConfig,
      commentReply: {
        enabled,
        mode,
        fixedMessage: mode === "fixed" ? (fixedMessage ?? "") : "",
        sendPrivateDM,
        updatedAt: new Date().toISOString(),
      },
    };

    await db.integration.update({
      where: { integrationId },
      data: { config: updatedConfig },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMMENT_REPLY_API]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
