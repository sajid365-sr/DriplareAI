import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await db.integration.findMany({
      where: { chatbotId },
    });

    // We merge with all available platforms
    const platforms = [
      { platform: "facebook", name: "Facebook Messenger", description: "Connect your bot to your Facebook Page to auto-reply to customers.", color: "#1877F2" },
      { platform: "n8n_facebook", name: "n8n Facebook (Test)", description: "Test Facebook Automation using n8n workflows.", color: "#ff6d5a" },
      { platform: "whatsapp", name: "WhatsApp Business", description: "Deploy your AI assistant to WhatsApp.", color: "#25D366" },
      { platform: "website", name: "Website Widget", description: "Embed a chat bubble on your website.", color: "#6d28d9" },
      { platform: "n8n_source", name: "n8n Knowledge Ingest", description: "Test knowledge base ingestion using n8n workflows.", color: "#ff6d5a" },
      { platform: "slack", name: "Slack", description: "Answer questions in Slack channels.", color: "#4A154B", coming_soon: true },
      { platform: "telegram", name: "Telegram", description: "Deploy as a Telegram bot.", color: "#229ED9", coming_soon: true },
      { platform: "webhook", name: "Custom Webhook", description: "Connect to anything using Webhooks.", color: "#f97316" },
      { platform: "custom_api", name: "REST API", description: "Build your own custom client.", color: "#3b82f6" },
    ];

    const result = platforms.map(p => {
      const dbInt = integrations.find(i => i.platform === p.platform);
      return {
        ...p,
        connected: dbInt?.connected || false,
        status: dbInt?.status || "active",
        lastError: dbInt?.lastError || null,
        config: dbInt?.config || {},
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[INTEGRATIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
