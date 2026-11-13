import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { db } from "@/lib/core/db";
import { extractExcelKnowledge, SpreadsheetIngestionError } from "@/lib/ai/spreadsheet-ingestion";
import { randomUUID } from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  let uploadedSourceId: string | undefined;
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

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Files must be 15 MB or less" }, { status: 413 });
    }
    let extractedSpreadsheetText: string | null = null;
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      try {
        extractedSpreadsheetText = await extractExcelKnowledge(
          file.name,
          new Uint8Array(await file.arrayBuffer())
        );
      } catch (error) {
        if (error instanceof SpreadsheetIngestionError) {
          return NextResponse.json({ error: error.message }, { status: 422 });
        }
        throw error;
      }
    }

    const rawSourceId = formData.get("sourceId");
    if (rawSourceId !== null && typeof rawSourceId !== "string") {
      return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
    }
    const requestedSourceId = typeof rawSourceId === "string" ? rawSourceId.trim() : "";
    uploadedSourceId = requestedSourceId
      ? requestedSourceId
      : `src_${randomUUID().replace(/-/g, "")}`;
    const retrySource = requestedSourceId
      ? await db.source.findFirst({
        where: { sourceId: uploadedSourceId, chatbotId, type: "file", ingestionStatus: "failed" },
        select: { sourceId: true },
      })
      : null;
    if (requestedSourceId && !retrySource) {
      return NextResponse.json({ error: "This file upload cannot be retried.", sourceId: uploadedSourceId }, { status: 404 });
    }

    if (retrySource) {
      await db.source.update({
        where: { sourceId: uploadedSourceId },
        data: { ingestionStatus: "processing", name: file.name, content: null, charCount: 0 },
      });
    } else {
      await db.source.create({
        data: {
          sourceId: uploadedSourceId,
          chatbotId,
          type: "file",
          name: file.name,
          ingestionStatus: "processing",
        },
      });
    }

    const n8nUrl = process.env.N8N_INGEST_WEBHOOK_URL;
    if (!n8nUrl) {
      console.error("[SOURCE_FILE] Missing N8N_INGEST_WEBHOOK_URL in .env");
      await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "failed" } });
      return NextResponse.json({ error: "Server misconfiguration", sourceId: uploadedSourceId }, { status: 500 });
    }

    // Forward the file and metadata to n8n
    const n8nFormData = new FormData();
    n8nFormData.append("file", file, file.name);
    n8nFormData.append("sourceId", uploadedSourceId);
    n8nFormData.append("chatbotId", chatbotId);
    n8nFormData.append("userId", userId);
    n8nFormData.append("type", "file");
    n8nFormData.append("name", file.name);
    if (extractedSpreadsheetText) n8nFormData.append("extractedText", extractedSpreadsheetText);

    console.log(`[SOURCE_FILE] Forwarding file ${file.name} (ID: ${uploadedSourceId}) to n8n...`);
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      body: n8nFormData,
    });

    const responseBody = await n8nRes.text();
    let n8nResult: unknown = null;
    try {
      n8nResult = responseBody ? JSON.parse(responseBody) : null;
    } catch {
      n8nResult = null;
    }
    if (!n8nRes.ok || !n8nResult || typeof n8nResult !== "object" || !("success" in n8nResult) || n8nResult.success !== true) {
      await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "failed" } });
      console.error("[SOURCE_FILE] n8n did not complete ingestion", {
        status: n8nRes.status,
        response: responseBody.slice(0, 500),
      });
      const errorMessage = n8nResult && typeof n8nResult === "object" && "error" in n8nResult && typeof n8nResult.error === "string"
        ? n8nResult.error
        : "Failed to process file in n8n backend";
      return NextResponse.json({ error: errorMessage, sourceId: uploadedSourceId }, { status: n8nRes.ok ? 502 : n8nRes.status });
    }
    await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "ready" } });
    return NextResponse.json({ ...(n8nResult as Record<string, unknown>), sourceId: uploadedSourceId });
  } catch (error) {
    console.error("[SOURCE_FILE]", error);
    if (uploadedSourceId) {
      await db.source.updateMany({
        where: { sourceId: uploadedSourceId, ingestionStatus: "processing" },
        data: { ingestionStatus: "failed" },
      });
    }
    return NextResponse.json({
      error: "Internal Error",
      ...(uploadedSourceId ? { sourceId: uploadedSourceId } : {}),
    }, { status: 500 });
  }
}
