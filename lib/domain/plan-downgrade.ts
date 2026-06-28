import "server-only";
import { db } from "@/lib/core/db";
import { getPlan, getTotalIntegrationLimit, type PlanKey } from "@/lib/domain/plan-config";
import { type Region } from "@/lib/core/region";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DowngradePreview {
  currentPlan: string;
  targetPlan: string;
  effectiveDate: Date;
  chatbots: {
    current: number;
    newLimit: number;
    toBePaused: number;
  };
  integrations: {
    current: number;
    newLimit: number;
    toBePaused: number;
  };
  credits: {
    current: number;
    newLimit: number;
  };
}

// ─────────────────────────────────────────────
// 1. Preview: কতটি chatbot/integration pause হবে তা দেখাও
// ─────────────────────────────────────────────

export async function getDowngradePreview(
  userId: string,
  targetPlan: PlanKey
): Promise<DowngradePreview | null> {
  const user = await db.user.findUnique({
    where: { userId },
    select: {
      plan: true,
      region: true,
      includedCredits: true,
      creditsResetDate: true,
    },
  });

  if (!user) return null;

  const region = (user.region || "bd") as Region;
  const targetConfig = getPlan(region, targetPlan);
  const currentConfig = getPlan(region, user.plan as PlanKey);

  // Count active (non-paused) chatbots
  const activeChatbotCount = await db.chatbot.count({
    where: { userId, status: { not: "paused" } },
  });

  // Count active (non-paused) integrations
  const activeIntegrationCount = await db.integration.count({
    where: {
      chatbot: { userId },
      connected: true,
      status: { not: "paused" },
    },
  });
  const targetIntegrationLimit = getTotalIntegrationLimit(targetConfig);

  const chatbotsToBePaused = Math.max(
    0,
    activeChatbotCount - targetConfig.maxChatbots
  );
  const integrationsToBePaused = Math.max(
    0,
    activeIntegrationCount - targetIntegrationLimit
  );

  const effectiveDate = user.creditsResetDate;

  return {
    currentPlan: user.plan,
    targetPlan,
    effectiveDate,
    chatbots: {
      current: activeChatbotCount,
      newLimit: targetConfig.maxChatbots,
      toBePaused: chatbotsToBePaused,
    },
    integrations: {
      current: activeIntegrationCount,
      newLimit: targetIntegrationLimit,
      toBePaused: integrationsToBePaused,
    },
    credits: {
      current: currentConfig.includedCredits,
      newLimit: targetConfig.includedCredits,
    },
  };
}

// ─────────────────────────────────────────────
// 2. Schedule: Downgrade-কে billing period শেষের জন্য schedule করো
// ─────────────────────────────────────────────

export async function scheduleDowngrade(
  userId: string,
  targetPlan: PlanKey,
  cancelReason?: string
) {
  const user = await db.user.findUnique({
    where: { userId },
    select: { creditsResetDate: true, plan: true },
  });

  if (!user) throw new Error("User not found");

  const effectiveDate = user.creditsResetDate;

  await db.user.update({
    where: { userId },
    data: {
      scheduledDowngradePlan: targetPlan,
      scheduledDowngradeAt: effectiveDate,
    },
  });

  // Notification create করো
  await db.notification.create({
    data: {
      userId,
      type: "plan",
      title: "Downgrade Scheduled",
      message: `Your plan will change to ${targetPlan.toUpperCase()} on ${effectiveDate.toLocaleDateString()}. Until then, you can enjoy your current plan fully.`,
    },
  });

  // Cancel reason log করো (optional)
  if (cancelReason) {
    console.log(
      `[scheduleDowngrade] User ${userId} downgrade reason: ${cancelReason}`
    );
  }

  return { scheduledAt: effectiveDate };
}

// ─────────────────────────────────────────────
// 3. Cancel Scheduled Downgrade: Scheduled downgrade বাতিল করো
// ─────────────────────────────────────────────

export async function cancelScheduledDowngrade(userId: string) {
  await db.user.update({
    where: { userId },
    data: {
      scheduledDowngradePlan: null,
      scheduledDowngradeAt: null,
    },
  });

  await db.notification.create({
    data: {
      userId,
      type: "plan",
      title: "Downgrade Cancelled",
      message:
        "Your scheduled plan change has been cancelled. Your current plan remains active.",
    },
  });
}

// ─────────────────────────────────────────────
// 4. Apply Downgrade: Actual downgrade execute করো (Cron দ্বারা কল হয়)
//    - Excess chatbot → status="paused"
//    - Excess integration → connected=false, status="paused"
//    - User plan update
// ─────────────────────────────────────────────

export async function applyDowngrade(userId: string, targetPlan: PlanKey) {
  const user = await db.user.findUnique({
    where: { userId },
    select: {
      region: true,
      plan: true,
      includedCredits: true,
      creditsResetDate: true,
    },
  });

  if (!user) throw new Error("User not found");

  const region = (user.region || "bd") as Region;
  const targetConfig = getPlan(region, targetPlan);
  const targetIntegrationLimit = getTotalIntegrationLimit(targetConfig);

  // ── Pause excess chatbots (newest first, keep oldest active) ──
  const activeChatbots = await db.chatbot.findMany({
    where: { userId, status: { not: "paused" } },
    orderBy: { createdAt: "asc" }, // oldest first → keep these, pause the newer ones
    select: { id: true },
  });

  const chatbotsToKeep = activeChatbots.slice(0, targetConfig.maxChatbots);
  const chatbotIdsToPause = activeChatbots
    .slice(targetConfig.maxChatbots)
    .map((c) => c.id);

  if (chatbotIdsToPause.length > 0) {
    await db.chatbot.updateMany({
      where: { id: { in: chatbotIdsToPause } },
      data: { status: "paused" },
    });
  }

  // ── Pause excess integrations ──
  const activeIntegrations = await db.integration.findMany({
    where: {
      chatbot: { userId },
      connected: true,
      status: { not: "paused" },
    },
    orderBy: { connectedAt: "asc" }, // oldest first → keep these
    select: { id: true },
  });

  const integrationsToPause = activeIntegrations.slice(
    targetIntegrationLimit
  );
  const integrationIdsToPause = integrationsToPause.map((i) => i.id);

  if (integrationIdsToPause.length > 0) {
    await db.integration.updateMany({
      where: { id: { in: integrationIdsToPause } },
      data: {
        connected: false,
        status: "paused",
      },
    });
  }

  // ── User plan update ──
  const nextResetDate = new Date();
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  await db.user.update({
    where: { userId },
    data: {
      plan: targetPlan,
      includedCredits: targetConfig.includedCredits,
      creditsBalance: targetConfig.includedCredits,
      creditsUsedThisCycle: 0,
      creditsResetDate: nextResetDate,
      scheduledDowngradePlan: null,
      scheduledDowngradeAt: null,
    },
  });

  // ── Notification ──
  await db.notification.create({
    data: {
      userId,
      type: "plan",
      title: "Plan Changed",
      message: `Your plan has been changed to ${targetPlan.toUpperCase()}. ${
        chatbotIdsToPause.length > 0
          ? `${chatbotIdsToPause.length} chatbot(s) have been paused.`
          : ""
      } ${
        integrationIdsToPause.length > 0
          ? `${integrationIdsToPause.length} integration(s) have been paused.`
          : ""
      } Upgrade anytime to reactivate them.`,
    },
  });

  return {
    pausedChatbots: chatbotIdsToPause.length,
    pausedIntegrations: integrationIdsToPause.length,
    newPlan: targetPlan,
    keptActiveChatbots: chatbotsToKeep.length,
  };
}

// ─────────────────────────────────────────────
// 5. Process All Due Downgrades (Cron Job-এর জন্য)
// ─────────────────────────────────────────────

export async function processAllDueDowngrades() {
  const now = new Date();

  // সব user যাদের scheduled downgrade আজকের আগে বা আজকে
  const usersWithDueDowngrades = await db.user.findMany({
    where: {
      scheduledDowngradePlan: { not: null },
      scheduledDowngradeAt: { lte: now },
    },
    select: {
      userId: true,
      scheduledDowngradePlan: true,
    },
  });

  const results = [];

  for (const user of usersWithDueDowngrades) {
    if (!user.scheduledDowngradePlan) continue;

    try {
      const result = await applyDowngrade(
        user.userId,
        user.scheduledDowngradePlan as PlanKey
      );
      results.push({ userId: user.userId, success: true, ...result });
      console.log(
        `[Cron] Downgrade applied for user ${user.userId} → ${user.scheduledDowngradePlan}`
      );
    } catch (err) {
      results.push({ userId: user.userId, success: false, error: String(err) });
      console.error(`[Cron] Downgrade failed for user ${user.userId}:`, err);
    }
  }

  return results;
}
