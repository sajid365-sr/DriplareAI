import { db } from "./db";
import { getPlan, type PlanKey } from "./plan-config";
import { type Region } from "./region";

/**
 * Check if the user can create another chatbot.
 */
export async function canCreateChatbot(userId: string) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true }
  });

  if (!user) return { allowed: false, error: "User not found" };

  const chatbotCount = await db.chatbot.count({
    where: { userId }
  });

  const region = (user.region || "bd") as Region;
  const planConfig = getPlan(region, (user.plan || "starter") as PlanKey);

  if (chatbotCount >= planConfig.maxChatbots) {
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
export async function canAddIntegration(userId: string, platform: string) {
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

  // Count existing unique integrations across all chatbots
  const integrationCount = await db.integration.count({
    where: { 
      chatbot: { userId },
      connected: true
    }
  });

  if (integrationCount >= planConfig.maxIntegrations) {
    return { 
      allowed: false, 
      error: `Limit reached. Your ${user.plan.toUpperCase()} plan allows only ${planConfig.maxIntegrations} integrations.` 
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

  const chatbotCount = await db.chatbot.count({ where: { userId } });
  const integrationCount = await db.integration.count({
    where: { 
      chatbot: { userId },
      connected: true
    }
  });

  return {
    plan: user.plan,
    chatbots: {
      used: chatbotCount,
      limit: planConfig.maxChatbots,
      isExceeded: chatbotCount > planConfig.maxChatbots
    },
    integrations: {
      used: integrationCount,
      limit: planConfig.maxIntegrations,
      isExceeded: integrationCount > planConfig.maxIntegrations
    }
  };
}
