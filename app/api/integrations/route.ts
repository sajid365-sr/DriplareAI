import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

const DEFAULT_MOCK_INTEGRATIONS = (bots: any[]) => {
  const bot1 = bots[0] || { chatbotId: "bot-1", name: "Driplare Inbox" };
  const bot2 = bots[1] || { chatbotId: "bot-2", name: "Sales Assistant Bot" };
  const bot3 = bots[2] || bot1;

  return [
    {
      id: "int-mock-1",
      integrationId: "int-1",
      chatbotId: bot1.chatbotId,
      botName: bot1.name,
      platform: "facebook",
      accountName: "Baby Mart FB Page",
      accountId: "FB-PAGE-99214",
      connected: true,
      status: "active",
      connectedAt: new Date().toISOString(),
      config: {
        muteAiOnHandover: true,
        tokenStatus: "valid",
        commentReply: {
          enabled: true,
          sendPrivateDM: true,
          keywords: "Price, Details, দাম কত, স্টকে আছে",
          fixedMessage: "ধন্যবাদ! মেসেজে বিস্তারিত প্রাইস লিস্ট ও ক্যাটালগ পাঠানো হলো।",
        },
      },
    },
    {
      id: "int-mock-2",
      integrationId: "int-2",
      chatbotId: bot2.chatbotId,
      botName: bot2.name,
      platform: "facebook",
      accountName: "Driplare E-Commerce Main",
      accountId: "FB-PAGE-44120",
      connected: true,
      status: "active",
      connectedAt: new Date().toISOString(),
      config: {
        muteAiOnHandover: false,
        tokenStatus: "valid",
        commentReply: {
          enabled: false,
          sendPrivateDM: false,
          keywords: "",
          fixedMessage: "",
        },
      },
    },
    {
      id: "int-mock-3",
      integrationId: "int-3",
      chatbotId: bot3.chatbotId,
      botName: bot3.name,
      platform: "instagram",
      accountName: "@driplare.official",
      accountId: "IG-ACC-11029",
      connected: true,
      status: "active",
      connectedAt: new Date().toISOString(),
      config: {
        muteAiOnHandover: true,
        tokenStatus: "valid",
        commentReply: {
          enabled: true,
          sendPrivateDM: true,
          keywords: "Price, DM",
          fixedMessage: "Please check your DMs for price details! ✨",
        },
      },
    },
    {
      id: "int-mock-4",
      integrationId: "int-4",
      chatbotId: bot2.chatbotId,
      botName: bot2.name,
      platform: "whatsapp",
      accountName: "WhatsApp Sales Line (+880 1894-927244)",
      accountId: "+8801894927244",
      connected: true,
      status: "active",
      connectedAt: new Date().toISOString(),
      config: {
        muteAiOnHandover: true,
        tokenStatus: "valid",
      },
    },
    {
      id: "int-mock-5",
      integrationId: "int-5",
      chatbotId: bot1.chatbotId,
      botName: bot1.name,
      platform: "messenger",
      accountName: "Website Live Widget (driplare.ai)",
      accountId: "WIDGET-001",
      connected: true,
      status: "active",
      connectedAt: new Date().toISOString(),
      config: {
        muteAiOnHandover: false,
      },
    },
  ];
};

export async function GET(req: Request) {
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

    if (dbIntegrations.length > 0) {
      const formatted = dbIntegrations.map((item) => {
        const config = (item.config as Record<string, any>) || {};
        return {
          id: item.id,
          integrationId: item.integrationId,
          chatbotId: item.chatbotId,
          botName: item.chatbot?.name || "AI Agent",
          platform: item.platform,
          accountName: config.accountName || config.pageName || config.displayPhoneNumber || `${item.platform} Account`,
          accountId: config.accountId || config.pageId || config.phoneNumberId || item.id,
          connected: item.connected,
          status: item.status,
          lastError: item.lastError,
          connectedAt: item.connectedAt?.toISOString() || null,
          config,
        };
      });

      return NextResponse.json({
        chatbots: userBots,
        integrations: formatted,
      });
    }

    // Fallback seed / demo state if no DB integrations yet
    return NextResponse.json({
      chatbots: userBots.length > 0 ? userBots : [
        { id: "b1", chatbotId: "bot-1", name: "Driplare Inbox" },
        { id: "b2", chatbotId: "bot-2", name: "Sales Assistant Bot" },
        { id: "b3", chatbotId: "bot-3", name: "Customer Support Agent" },
      ],
      integrations: DEFAULT_MOCK_INTEGRATIONS(
        userBots.length > 0
          ? userBots
          : [
              { chatbotId: "bot-1", name: "Driplare Inbox" },
              { chatbotId: "bot-2", name: "Sales Assistant Bot" },
              { chatbotId: "bot-3", name: "Customer Support Agent" },
            ]
      ),
    });
  } catch (error) {
    console.error("[INTEGRATIONS_GET_ALL]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
