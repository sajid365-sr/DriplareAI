import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";
import { extractExcelKnowledge, SpreadsheetIngestionError } from "@/lib/ai/spreadsheet-ingestion";
import { randomUUID } from "node:crypto";

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const sources = await db.source.findMany({ where: { workspaceId, isGlobal: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(sources);
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let uploadedSourceId: string | undefined;
  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
      if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Files must be 15 MB or less" }, { status: 413 });
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
      const rawSourceId = form.get("sourceId");
      if (rawSourceId !== null && typeof rawSourceId !== "string") {
        return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
      }
      const requestedSourceId = typeof rawSourceId === "string" ? rawSourceId.trim() : "";
      uploadedSourceId = requestedSourceId
        ? requestedSourceId
        : `src_${randomUUID().replace(/-/g, "")}`;
      const retrySource = requestedSourceId
        ? await db.source.findFirst({
          where: {
            sourceId: uploadedSourceId,
            workspaceId,
            isGlobal: true,
            type: "file",
            ingestionStatus: "failed",
          },
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
            workspaceId,
            isGlobal: true,
            type: "file",
            name: file.name,
            ingestionStatus: "processing",
          },
        });
      }

      const ingestUrl = process.env.N8N_INGEST_WEBHOOK_URL;
      if (!ingestUrl) {
        await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "failed" } });
        return NextResponse.json({ error: "File ingestion is not configured", sourceId: uploadedSourceId }, { status: 503 });
      }

      const ingestForm = new FormData();
      ingestForm.append("file", file, file.name);
      ingestForm.append("sourceId", uploadedSourceId);
      ingestForm.append("chatbotId", "");
      ingestForm.append("workspaceId", workspaceId);
      ingestForm.append("userId", userId);
      ingestForm.append("isGlobal", "true");
      ingestForm.append("type", "file");
      ingestForm.append("name", file.name);
      if (extractedSpreadsheetText) ingestForm.append("extractedText", extractedSpreadsheetText);
      const ingestResponse = await fetch(ingestUrl, { method: "POST", body: ingestForm });
      const responseBody = await ingestResponse.text();
      if (!ingestResponse.ok) {
        await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "failed" } });
        if (ingestResponse.status === 404 && /webhook.+not registered/i.test(responseBody)) {
          const usesTestWebhook = new URL(ingestUrl).pathname.split("/").includes("webhook-test");
          console.error("[WORKSPACE_SOURCE_FILE] n8n ingestion webhook is not registered", {
            status: ingestResponse.status,
            usesTestWebhook,
          });
          return NextResponse.json({
            code: usesTestWebhook
              ? "N8N_INGEST_TEST_WEBHOOK_NOT_LISTENING"
              : "N8N_INGEST_PRODUCTION_WEBHOOK_NOT_ACTIVE",
            error: "File ingestion webhook is not registered.",
            sourceId: uploadedSourceId,
          }, { status: 503 });
        }
        console.error("[WORKSPACE_SOURCE_FILE] n8n ingestion failed", {
          status: ingestResponse.status,
          response: responseBody.slice(0, 500),
        });
        return NextResponse.json({ error: "Failed to process file", sourceId: uploadedSourceId }, { status: 502 });
      }
      let workflowResult: unknown;
      try {
        workflowResult = responseBody ? JSON.parse(responseBody) : null;
      } catch {
        workflowResult = null;
      }
      if (!workflowResult || typeof workflowResult !== "object" || !("success" in workflowResult) || workflowResult.success !== true) {
        await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "failed" } });
        return NextResponse.json({ error: "File processing did not complete successfully.", sourceId: uploadedSourceId }, { status: 502 });
      }
      await db.source.update({ where: { sourceId: uploadedSourceId }, data: { ingestionStatus: "ready" } });
      return NextResponse.json({ success: true, sourceId: uploadedSourceId, message: "File added to company knowledge" }, { status: 201 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const { name, content, url } = body as { name?: unknown; content?: unknown; url?: unknown };
    if (typeof url === "string" && url.trim()) {
      let parsedUrl: URL;
      try { parsedUrl = new URL(url); } catch { return NextResponse.json({ error: "Enter a valid website URL" }, { status: 400 }); }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return NextResponse.json({ error: "Only HTTP and HTTPS URLs are supported" }, { status: 400 });
      const ingestUrl = process.env.N8N_INGEST_WEBHOOK_URL;
      if (!ingestUrl) return NextResponse.json({ error: "Website ingestion is not configured" }, { status: 503 });
      const ingestForm = new FormData();
      ingestForm.append("sourceId", `src_${randomUUID().replace(/-/g, "")}`);
      ingestForm.append("chatbotId", "");
      ingestForm.append("workspaceId", workspaceId);
      ingestForm.append("userId", userId);
      ingestForm.append("isGlobal", "true");
      ingestForm.append("type", "website");
      ingestForm.append("name", parsedUrl.toString());
      ingestForm.append("url", parsedUrl.toString());
      const ingestResponse = await fetch(ingestUrl, { method: "POST", body: ingestForm });
      if (!ingestResponse.ok) return NextResponse.json({ error: "Failed to process website" }, { status: 502 });
      return NextResponse.json({ success: true, message: "Website added to workspace knowledge" }, { status: 201 });
    }
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });
    if (content.length > 50_000) return NextResponse.json({ error: "Content must be 50,000 characters or less" }, { status: 413 });

    const source = await createSourceWithEmbeddings({
      workspaceId,
      isGlobal: true,
      type: "text",
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 160) : "Company knowledge",
      content,
    });
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("[WORKSPACE_SOURCES_POST]", error);
    if (uploadedSourceId) {
      await db.source.updateMany({
        where: { sourceId: uploadedSourceId, ingestionStatus: "processing" },
        data: { ingestionStatus: "failed" },
      });
    }
    return NextResponse.json({
      error: "Failed to process company knowledge",
      ...(uploadedSourceId ? { sourceId: uploadedSourceId } : {}),
    }, { status: 500 });
  }
}
