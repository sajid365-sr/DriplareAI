import "server-only";
import { db } from "@/lib/core/db";
import { getPlan, getTotalIntegrationLimit, type PlanKey } from "@/lib/domain/plan-config";
import { reconcilePromptModeForPlan } from "@/lib/ai/plan-model-access";
import { listExpiredUnpaidTrials } from "@/lib/domain/trial";
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

/**
 * chatbot গুলো বন্ধ করা (pause) — **একটিই জায়গা, একটিই আচরণ**।
 *
 * ⚠️ কেন helper (১৫.৬): এখন দুই জায়গায় pause লাগে — plan downgrade-এ
 *    (বাড়তি bot) আর trial মেয়াদ শেষে (সব bot)। `applyDowngrade` পুনর্ব্যবহার
 *    করা যেত না, কারণ ওটি **plan বদলে দেয়** (target plan-এর credit বসায়) —
 *    trial শেষে সেটি করলে ১৫,০০০ credit আবার বসে leak-টা আবার খুলে যেত।
 *    তাই যেটুকু সত্যিই সাধারণ — pause করা — সেটুকু এখানে, আর সিদ্ধান্ত দুটি
 *    নিজ নিজ জায়গায়।
 */
export async function pauseChatbots(chatbotIds: string[]): Promise<number> {
  if (chatbotIds.length === 0) return 0;

  const result = await db.chatbot.updateMany({
    where: { id: { in: chatbotIds } },
    data: { status: "paused" },
  });

  return result.count;
}

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

  await pauseChatbots(chatbotIdsToPause);

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

  // ── Pro মোড আর নেই এমন bot-কে Simple-এ ফেরানো ──
  //
  // ⚠️ plan লেখার **পরে** ডাকা হয়, কারণ নিয়মটা নতুন plan-এর উপর নির্ভর করে।
  //    এটা না করলে Starter-এ নেমে যাওয়া একটা bot-এর গায়ে পুরনো Pro মডেল-আইডি
  //    পড়ে থাকত, আর `resolveModelConfig` tier-কী খুঁজে না পেয়ে সেই ভারী
  //    মডেলটাই চালাতে থাকত: পর্দায় কোনো কার্ড উজ্জ্বল নয়, অথচ বিলে খরচ হচ্ছে।
  //    (বিস্তারিত `reconcilePromptModeForPlan`-এ।)
  const reconciledChatbots = await reconcilePromptModeForPlan(userId, targetPlan);

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
      } ${
        // কারণটা লেখা থাকে — নাহলে merchant হঠাৎ সস্তা tier দেখে ধরে নিতেন
        // সেটআপ নষ্ট হয়ে গেছে, আর নিজে থেকে আবার বদলে ফেলতেন।
        reconciledChatbots > 0
          ? `${reconciledChatbots} chatbot(s) moved to the Simple setup, because Pro mode is not part of your new plan.`
          : ""
      } Upgrade anytime to reactivate them.`,
    },
  });

  return {
    pausedChatbots: chatbotIdsToPause.length,
    pausedIntegrations: integrationIdsToPause.length,
    newPlan: targetPlan,
    keptActiveChatbots: chatbotsToKeep.length,
    reconciledChatbots,
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

// ─────────────────────────────────────────────
// 6. Trial মেয়াদ শেষ (১৫.৬) — একই cron, আলাদা selector
// ─────────────────────────────────────────────

/**
 * মেয়াদোত্তীর্ণ ও অ-পরিশোধিত trial-এর chatbot গুলো বন্ধ করে।
 *
 * ── কেন `scheduleDowngrade`/`applyDowngrade` **নয়** ────────────────────────
 * `applyDowngrade` target plan-এর allowance বসায়, অর্থাৎ trial শেষে সেটি
 * চালালে ১৫,০০০ credit আবার বসত — ১৫.৯ যে ছিদ্রটি বন্ধ করল, সেটিই আবার খুলে যেত
 * (তবে প্রতিবার chatbot বন্ধ করে দিতে হত, অর্থাৎ merchant দেখতেন "plan আছে,
 * credit আছে, অথচ bot বন্ধ")। এখানে তাই সিদ্ধান্তটি আলাদা ও স্পষ্ট:
 *
 *   - chatbot → `paused` (সেবা বন্ধ, কারণ টাকা নেই)
 *   - integration → **connected-ই থাকে**। খেয়াল রাখুন: Facebook/WhatsApp
 *     আবার connect করা merchant-এর জন্য কষ্টকর (token, app review), আর টাকা
 *     দেওয়া মাত্রই সব ফিরে পাওয়া উচিত — তাই সংযোগ ভাঙা হয় না।
 *   - balance → **শূন্য করা হয় না**। ধ্বংসাত্মক, আর অপ্রয়োজনীয়: bot paused
 *     থাকলে AI চলে না, তাই খরচও হয় না। যা টাকায় কেনা (top-up) তা তো তাঁরই।
 *   - `planExpiresAt` → **মোছা হয় না**। সেটিই একমাত্র দলিল যে trial ব্যবহৃত
 *     হয়েছে; মুছলে `startTrialIfEligible` আবার trial দিত (re-arm), অর্থাৎ
 *     ছিদ্রটি ফিরে আসত।
 *
 * ── Idempotency (কোনো নতুন কলাম ছাড়াই) ────────────────────────────────────
 * cron প্রতিদিন চলে, আর এই selector প্রতিদিনই একই মেয়াদোত্তীর্ণ user-দের
 * ফেরত দেয়। notification তাই **কেবল তখনই** পাঠানো হয় যখন সত্যিই কিছু bot
 * বন্ধ হলো (`paused > 0`) — সব bot আগেই paused থাকলে দিনের কাজটি নীরব no-op।
 * ফলে user প্রতিদিন একই email পান না, আর সব bot-ই যদি বন্ধ থাকে তবে কোনো
 * `user.update`-ও লাগে না।
 */
export async function processExpiredTrials(): Promise<
  Array<{ userId: string; pausedChatbots: number; planExpiresAt: Date }>
> {
  const trials = await listExpiredUnpaidTrials();
  const results: Array<{ userId: string; pausedChatbots: number; planExpiresAt: Date }> = [];

  for (const trial of trials) {
    try {
      const activeChatbots = await db.chatbot.findMany({
        where: { userId: trial.userId, status: { not: "paused" } },
        select: { id: true },
      });

      const pausedChatbots = await pauseChatbots(activeChatbots.map((bot) => bot.id));

      if (pausedChatbots > 0) {
        await db.notification.create({
          data: {
            userId: trial.userId,
            type: "plan",
            title: "Free Trial Ended",
            message:
              `Your free trial ended on ${trial.planExpiresAt.toLocaleDateString()}, so ${pausedChatbots} chatbot(s) have been paused. ` +
              "Your channels stay connected and your remaining credits are untouched — subscribe to start them again right away.",
          },
        });
      }

      results.push({
        userId: trial.userId,
        pausedChatbots,
        planExpiresAt: trial.planExpiresAt,
      });

      console.log(
        `[Cron] Trial expired for user ${trial.userId}: ${pausedChatbots} chatbot(s) paused`
      );
    } catch (err) {
      console.error(`[Cron] Trial expiry failed for user ${trial.userId}:`, err);
    }
  }

  return results;
}
