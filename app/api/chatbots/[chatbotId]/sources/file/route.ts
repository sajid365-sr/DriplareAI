import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { randomUUID } from "crypto";

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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const n8nUrl = process.env.N8N_INGEST_WEBHOOK_URL;
    if (!n8nUrl) {
      console.error("[SOURCE_FILE] Missing N8N_INGEST_WEBHOOK_URL in .env");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Generate a professional unique ID here
    const sourceId = `src_${randomUUID().replace(/-/g, "")}`;

    // Forward the file and metadata to n8n
    const n8nFormData = new FormData();
    n8nFormData.append("file", file);
    n8nFormData.append("sourceId", sourceId); // Sending the generated ID
    n8nFormData.append("chatbotId", chatbotId);
    n8nFormData.append("userId", userId);
    n8nFormData.append("type", "file");
    n8nFormData.append("name", file.name);

    console.log(`[SOURCE_FILE] Forwarding file ${file.name} (ID: ${sourceId}) to n8n...`);
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      body: n8nFormData,
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      console.error("[SOURCE_FILE] n8n responded with error:", errText);
      return NextResponse.json({ error: "Failed to process file in n8n backend" }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "File forwarded to n8n with generated ID" });
  } catch (error) {
    console.error("[SOURCE_FILE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
