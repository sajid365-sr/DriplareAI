import { db } from "@/lib/core/db";
import {
  getPlan,
  getPlanIfDefined,
  planAllowsEcommerce,
  planAllowsPlatform,
  type PlanKey,
} from "@/lib/domain/plan-config";
import { type Region } from "@/lib/core/region";

/**
 * The caller's plan + region, with the same defaults every check in this file
 * uses. Returned as a pair because every entitlement question needs both, and
 * reading them separately is how two callers drift onto different answers.
 */
async function loadPlanScope(userId: string) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true },
  });

  if (!user) return null;

  return {
    plan: user.plan || "starter",
    region: (user.region || "bd") as Region,
  };
}

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
 *
 * ⚠️ দুটি ভিন্ন প্রশ্ন একসাথে উত্তর দেওয়া হয়, আর ক্রমটি গুরুত্বপূর্ণ:
 *    ১. এই **platform**-টি এই plan-এ খোলা আছে কি না (`planAllowsPlatform`,
 *       যা catalogue থেকেই নিয়ম নেয়), তারপর
 *    ২. এই chatbot-এ আরেকটি integration **ধরবে** কি না।
 */
export async function canAddIntegration(userId: string, platform: string, chatbotId: string) {
  const scope = await loadPlanScope(userId);
  if (!scope) return { allowed: false, error: "User not found" };

  const slug = String(platform ?? "").trim().toLowerCase();

  if (!planAllowsPlatform(scope.plan, scope.region, slug)) {
    return {
      allowed: false,
      error: `Upgrade required. Your ${scope.plan.toUpperCase()} plan does not support ${slug.toUpperCase()}.`,
    };
  }

  // ⚠️ যে platform-টি এখন connect করা হচ্ছে, সেটি গোনা হয় না।
  //
  // আগে সব `connected` integration গোনা হত, ফলে **ছাদের উপর থাকা** একটি
  // chatbot-এ পুরনো channel-টি আবার connect/reconnect করলে অনুরোধ প্রত্যাখ্যাত
  // হত: `count(1) >= max(1)`. অর্থাৎ merchant তাঁর একমাত্র Facebook channel-এর
  // টোকেন নবায়ন করতে পারতেন না, অথচ **নতুন** কিছু যোগ করছিলেন না।
  //
  // বাদ দিলে কিছুই শিথিল হয় না: যে platform এখনো connected নয়, তার জন্য
  // সংখ্যাটি আগের মতোই থাকে, তাই একটি **নতুন** channel ছাড়িয়ে যেতে পারে না।
  // যে platform আগেই connected, কেবল তার পুনঃসংযোগ আর আটকায় না — ঠিক যা উচিত।
  const planConfig = getPlanIfDefined(scope.region, scope.plan);
  const otherIntegrationCount = await db.integration.count({
    where: {
      chatbotId,
      connected: true,
      // `null` slug (ফাঁকা platform) — কিছুই বাদ যাবে না, অর্থাৎ পুরনো আচরণ।
      ...(slug ? { platform: { not: slug } } : {}),
    },
  });

  const maxIntegrations = planConfig?.maxIntegrationsPerChatbot ?? Infinity;

  if (otherIntegrationCount >= maxIntegrations) {
    return {
      allowed: false,
      error: `Limit reached. Your ${scope.plan.toUpperCase()} plan allows only ${maxIntegrations} integrations per chatbot.`,
    };
  }

  return { allowed: true };
}

/**
 * Courier + orders module — এই plan-এ আছে কি না।
 *
 * ⚠️ এই একটি gate-ই যথেষ্ট নয়: যে UI feature-টি দেখায়, সেটিকেও একই উত্তর
 *    জানতে হবে, নইলে nav-এ "Orders" থেকে গিয়ে 403 — যা না-থাকার চেয়ে খারাপ।
 *    তাই `Sidebar`-ও একই নিয়ম পড়ে (দেখুন `planAllowsEcommerce`)।
 */
export async function canUseEcommerce(userId: string) {
  const scope = await loadPlanScope(userId);
  if (!scope) return { allowed: false, error: "User not found" };

  if (!planAllowsEcommerce(scope.plan, scope.region)) {
    return {
      allowed: false,
      error: `Upgrade required. E-Commerce is not part of your ${scope.plan.toUpperCase()} plan.`,
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
    },
  };
}
