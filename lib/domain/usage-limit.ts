import { db } from "@/lib/core/db";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import { type Region } from "@/lib/core/region";

/**
 * Check if the user can create another chatbot.
 */
export async function canCreateChatbot(userId: string) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true }
  });

  if (!user) return { allowed: false, error: "User not found" };

  // Count ALL chatbots (active + paused) — paused ones still occupy the limit slot
  const totalChatbotCount = await db.chatbot.count({
    where: { userId }
  });

  const region = (user.region || "bd") as Region;
  const planConfig = getPlan(region, (user.plan || "starter") as PlanKey);

  if (totalChatbotCount >= planConfig.maxChatbots) {
    return { 
      allowed: false, 
      error: `Limit reached. Your ${user.plan.toUpperCase()} plan allows only ${planConfig.maxChatbots} chatbots.` 
    };
  }

  return { allowed: true };
}

/**
 * Check if the user can add another integration or use a specific platform.
 */
export async function canAddIntegration(userId: string, platform: string, chatbotId: string) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true }
  });

  if (!user) return { allowed: false, error: "User not found" };

  const region = (user.region || "bd") as Region;
  const planConfig = getPlan(region, (user.plan || "starter") as PlanKey);

  // Platform restriction check
  if (planConfig.allowedPlatforms.length > 0 && !planConfig.allowedPlatforms.includes("*")) {
    if (!planConfig.allowedPlatforms.includes(platform.toLowerCase())) {
      return { 
        allowed: false, 
        error: `Upgrade required. Your ${user.plan.toUpperCase()} plan does not support ${platform.toUpperCase()}.` 
      };
    }
  }

  // Count integrations for this specific chatbot (per-chatbot limit)
  const chatbotIntegrationCount = await db.integration.count({
    where: { 
      chatbotId,
      connected: true,
    }
  });

  if (chatbotIntegrationCount >= planConfig.maxIntegrationsPerChatbot) {
    return { 
      allowed: false, 
      error: `Limit reached. Your ${user.plan.toUpperCase()} plan allows only ${planConfig.maxIntegrationsPerChatbot} integrations per chatbot.` 
    };
  }

  return { allowed: true };
}

/**
 * Get current usage vs limits.
 */
export async function getUsageStatus(userId: string) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true }
  });

  if (!user) return null;

  const region = (user.region || "bd") as Region;
  const planConfig = getPlan(region, (user.plan || "starter") as PlanKey);

  const totalChatbotCount = await db.chatbot.count({
    where: { userId }
  });

  return {
    plan: user.plan,
    chatbots: {
      used: totalChatbotCount,
      limit: planConfig.maxChatbots,
      isExceeded: totalChatbotCount > planConfig.maxChatbots
    },
    integrationsPerChatbot: {
      limit: planConfig.maxIntegrationsPerChatbot,
    }
  };
}
