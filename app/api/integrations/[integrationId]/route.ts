import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrationId } = await params;
    const body = await req.json();
    const { chatbotId, config, connected } = body;

    // Check existing integration by integrationId or id
    const existing = await db.integration.findFirst({
      where: {
        OR: [{ integrationId }, { id: integrationId }],
        chatbot: { userId },
      },
    });

    if (existing) {
      const updatedConfig = config
        ? { ...((existing.config as Record<string, any>) || {}), ...config }
        : existing.config;

      const updated = await db.integration.update({
        where: { id: existing.id },
        data: {
          ...(chatbotId ? { chatbotId } : {}),
          ...(connected !== undefined ? { connected } : {}),
          config: updatedConfig,
        },
      });

      return NextResponse.json({ success: true, integration: updated });
    }

    // If it's a mock integration ID or new record in frontend state, return success
    return NextResponse.json({ success: true, integrationId, chatbotId, config });
  } catch (error) {
    console.error("[INTEGRATIONS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrationId } = await params;

    const existing = await db.integration.findFirst({
      where: {
        OR: [{ integrationId }, { id: integrationId }],
        chatbot: { userId },
      },
    });

    if (existing) {
      await db.integration.update({
        where: { id: existing.id },
        data: { connected: false, status: "disconnected" },
      });
    }

    return NextResponse.json({ success: true, integrationId });
  } catch (error) {
    console.error("[INTEGRATIONS_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
