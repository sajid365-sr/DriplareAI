import type { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";

export function getChannelFamily(platform: string): string {
  if (platform === "facebook" || platform === "n8n_facebook" || platform === "messenger") return "facebook_page";
  return platform;
}

export function getChannelIdentity(platform: string, config: Prisma.JsonValue | Prisma.InputJsonValue): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const values = config as Record<string, unknown>;
  const identity = platform === "whatsapp"
    ? values.phoneNumberId
    : platform === "instagram"
      ? values.instagramAccountId
      : platform.includes("facebook") || platform === "messenger"
        ? values.pageId
        : null;
  return typeof identity === "string" && identity ? identity : null;
}

export async function hasActiveChannelConflict(input: {
  workspaceId: string | null;
  chatbotId: string;
  platform: string;
  config: Prisma.JsonValue | Prisma.InputJsonValue;
}): Promise<boolean> {
  if (!input.workspaceId) return false;
  const identity = getChannelIdentity(input.platform, input.config);
  if (!identity) return false;
  const chatbots = await db.chatbot.findMany({ where: { workspaceId: input.workspaceId }, select: { chatbotId: true } });
  const rows = await db.integration.findMany({
    where: { chatbotId: { in: chatbots.map((bot) => bot.chatbotId) }, connected: true },
    select: { chatbotId: true, platform: true, connected: true, config: true },
  });
  return rows.some((row) => row.chatbotId !== input.chatbotId
    && getChannelFamily(row.platform) === getChannelFamily(input.platform)
    && getChannelIdentity(row.platform, row.config) === identity);
}

