import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { z } from "zod";

const StatusSchema = z.object({
  status: z.enum(["active", "disabled", "suspended"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await req.json();
    const parsed = StatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status parameter", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify chatbot exists
    const existingBot = await db.chatbot.findFirst({
      where: {
        OR: [{ id }, { chatbotId: id }],
      },
    });

    if (!existingBot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const updatedBot = await db.chatbot.update({
      where: { id: existingBot.id },
      data: { status: parsed.data.status },
      select: {
        id: true,
        chatbotId: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      bot: updatedBot,
    });
  } catch (error) {
    console.error("[ADMIN_BOT_TOGGLE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const existingBot = await db.chatbot.findFirst({
      where: {
        OR: [{ id }, { chatbotId: id }],
      },
    });

    if (!existingBot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    await db.chatbot.delete({
      where: { id: existingBot.id },
    });

    return NextResponse.json({
      success: true,
      deletedId: existingBot.id,
    });
  } catch (error) {
    console.error("[ADMIN_BOT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
