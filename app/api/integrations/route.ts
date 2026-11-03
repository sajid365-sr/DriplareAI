import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { buildPublicIntegrationConfig } from "@/lib/domain/integration-config";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

function configString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: (await getActiveWorkspace(userId)).workspaceId },
      select: {
        id: true,
        chatbotId: true,
        name: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const botIds = userBots.map((b) => b.chatbotId);

    const dbIntegrations = await db.integration.findMany({
      where: { chatbotId: { in: botIds } },
      include: {
        chatbot: {
          select: { name: true, chatbotId: true },
        },
      },
    });

    const formatted = dbIntegrations.map((item) => {
      const config = (item.config as Record<string, unknown>) || {};
      return {
        id: item.id,
        integrationId: item.integrationId,
        chatbotId: item.chatbotId,
        botName: item.chatbot?.name || "AI Agent",
        platform: item.platform,
        // Derived here, on the server, from the full config — the response
        // below carries only the allow-listed subset, which does not include
        // `accountName`/`accountId`.
        accountName: configString(config, "accountName") || configString(config, "pageName") || configString(config, "displayPhoneNumber") || `${item.platform} Account`,
        accountId: configString(config, "accountId") || configString(config, "pageId") || configString(config, "phoneNumberId") || item.id,
        connected: item.connected,
        status: item.status,
        lastError: item.lastError,
        connectedAt: item.connectedAt?.toISOString() || null,
        // Credentials are stripped: this response lists every integration of
        // every bot in the workspace, so returning `config` whole would hand
        // the browser every Page token and Cloud API token at once.
        config: buildPublicIntegrationConfig(item.config),
      };
    });

    return NextResponse.json({
      chatbots: userBots,
      integrations: formatted,
    });

  } catch (error) {
    console.error("[INTEGRATIONS_GET_ALL]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
