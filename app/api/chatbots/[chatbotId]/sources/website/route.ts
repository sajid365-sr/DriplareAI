import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

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

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const n8nUrl = process.env.N8N_INGEST_WEBHOOK_URL;
    if (!n8nUrl) {
      console.error("[SOURCE_WEBSITE] Missing N8N_INGEST_WEBHOOK_URL in .env");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Forward the URL to n8n so it can scrape and ingest
    console.log(`[SOURCE_WEBSITE] Forwarding website URL to n8n: ${url}`);
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbotId,
        userId,
        type: "website",
        name: url,
        url,
      }),
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      console.error("[SOURCE_WEBSITE] n8n responded with error:", errText);
      return NextResponse.json({ error: "Failed to process website in n8n backend" }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Website URL forwarded to n8n for processing" });
  } catch (error) {
    console.error("[SOURCE_WEBSITE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
