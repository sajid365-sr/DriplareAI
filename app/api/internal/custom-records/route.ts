import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { timingSafeEqualString } from "@/lib/core/timing-safe";
import { z } from "zod";

const ingestRecordSchema = z.object({
  chatbotId: z.string().min(1, "chatbotId is required"),
  sessionId: z.string().optional(),
  schemaSlug: z.string().min(1, "schemaSlug is required"),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
});

function rejected(reason: string) {
  return NextResponse.json({ success: false, reason });
}

export async function POST(req: Request) {
  // 1. Auth check
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTERNAL_CUSTOM_RECORDS] N8N_CALLBACK_SECRET is not set — endpoint closed");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!timingSafeEqualString(req.headers.get("x-n8n-secret"), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = ingestRecordSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      return rejected(`Invalid record data: ${msg}`);
    }

    const { chatbotId, sessionId, schemaSlug, customerName, customerPhone, data, notes } = parsed.data;

    // Verify Chatbot exists
    const bot = await db.chatbot.findFirst({
      where: {
        OR: [{ chatbotId }, { id: chatbotId }],
      },
      select: { chatbotId: true, workspaceId: true },
    });

    if (!bot) {
      return rejected(`Chatbot "${chatbotId}" not found.`);
    }

    // Forms belong to the workspace and can be used by any agent in that business.
    const schema = await db.customTableSchema.findFirst({
      where: bot.workspaceId
        ? { slug: schemaSlug, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: bot.chatbotId }] }
        : { chatbotId: bot.chatbotId, slug: schemaSlug },
      orderBy: { createdAt: "asc" },
    });

    if (!schema) {
      return rejected(
        `Form/Schema "${schemaSlug}" is not configured for this chatbot. Please check available forms.`
      );
    }

    // Insert record
    const record = await db.customRecord.create({
      data: {
        schemaId: schema.id,
        chatbotId: bot.chatbotId,
        sessionId: sessionId || null,
        customerName: customerName || (typeof data.customer_name === "string" ? data.customer_name : null),
        customerPhone: customerPhone || (typeof data.customer_phone === "string" ? data.customer_phone : null) || (typeof data.phone === "string" ? data.phone : null),
        data: JSON.parse(JSON.stringify(data)),
        status: "pending",
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Record submitted successfully under form "${schema.name}".`,
      recordId: record.id,
      schemaSlug: schema.slug,
      schemaName: schema.name,
    });
  } catch (error) {
    console.error("[INTERNAL_CUSTOM_RECORDS_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
