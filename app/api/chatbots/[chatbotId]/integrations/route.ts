import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const SAFE_CONFIG_KEYS = [
  "pageId",
  "pageName",
  "pageCategory",
  "pagePictureUrl",
  "instagramAccountId",
  "instagramUsername",
  "instagramName",
  "instagramProfilePictureUrl",
  "connectionSource",
  "wabaId",
  "phoneNumberId",
  "displayPhoneNumber",
  "verifiedName",
  "businessName",
  "qualityRating",
  "webhookSubscribedAt",
  "connectedAt",
  "tokenExpiresAt",
] as const;

function buildPublicIntegrationConfig(config: Prisma.JsonValue | null) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const source = config as Record<string, Prisma.JsonValue>;

  return SAFE_CONFIG_KEYS.reduce<Record<string, Prisma.JsonValue>>((safeConfig, key) => {
    if (source[key] !== undefined) {
      safeConfig[key] = source[key];
    }

    return safeConfig;
  }, {});
}

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

    const chatbot = await db.chatbot.findFirst({
      where: {
        chatbotId,
        userId,
      },
      select: {
        chatbotId: true,
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const integrations = await db.integration.findMany({
      where: { chatbotId },
    });

    // Fetch available platforms from DB
    const availablePlatforms = await db.availablePlatform.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    const result = availablePlatforms.map(p => {
      const canonicalPlatform = p.platformId === "n8n_facebook" ? "facebook" : p.platformId;
      const dbInt = integrations.find(i => i.platform === p.platformId) || integrations.find(i => i.platform === canonicalPlatform);
      return {
        platform: p.platformId,
        name: p.name,
        description: p.description,
        color: p.color,
        coming_soon: p.isComingSoon,
        connected: dbInt?.connected || false,
        status: dbInt?.status || "active",
        lastError: dbInt?.lastError || null,
        config: buildPublicIntegrationConfig(dbInt?.config ?? null),
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[INTEGRATIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
