import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getPlansForRegion, type PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

/**
 * Usage Threshold Alerts
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant-এর credit ব্যবহার ৮০% ও ১০০%-এ পৌঁছালে তাকে জানানো হয়, যাতে
 * সেবা বন্ধ হয়ে যাওয়ার আগেই সে renew/top-up করতে পারে।
 *
 * **কেন এত সাবধানতা:** deduction-টি প্রতি AI reply-তে হয় — অর্থাৎ এই function
 * দিনে হাজারবার call হতে পারে। তাই:
 *
 *  1. **Idempotency DB-level:** `UsageAlert`-এ
 *     `@@unique([userId, cycleStart, threshold, channel])` আছে। অ্যাপ্লিকেশন
 *     যতবারই trigger করুক, দ্বিতীয়বার insert `P2002`-এ আটকে যায় — merchant
 *     একই cycle-এ দুবার email পায় না।
 *  2. **Hot path non-blocking:** caller এটিকে `await` করে না — fire-and-forget
 *     (`void checkUsageThresholds(id).catch(...)`)। Email পাঠানো reply-এর
 *     latency-তে যোগ হয় না।
 *  3. **Cron safety net:** `check-and-deduct` ব্যর্থ হলে (যেমন ঠিক ১০০% ছোঁয়ার
 *     পর balance না থাকায় deduction-ই হয় না) cron আলাদাভাবে scan করে।
 */

/** যে threshold-গুলো monitor করা হয়, গুরুত্বের ক্রমে। */
const THRESHOLDS = [100, 80] as const;

type Threshold = (typeof THRESHOLDS)[number];

/** Alert-এর channel — unique constraint-এর অংশ। */
type AlertChannel = "email" | "app";

interface AlertOutcome {
  userId: string;
  fired: Array<{ threshold: Threshold; channel: AlertChannel }>;
  skipped: Array<{ threshold: Threshold; channel: AlertChannel; reason: string }>;
}

/**
 * একটি user-এর credit ব্যবহার যাচাই করে দরকার হলে alert পাঠায়।
 *
 * কখনো throw করে না — caller (hot path বা cron) যেন এর জন্য ব্যাহত না হয়।
 */
export async function checkUsageThresholds(userId: string): Promise<AlertOutcome | null> {
  const outcome: AlertOutcome = { userId, fired: [], skipped: [] };

  try {
    const user = await db.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        email: true,
        plan: true,
        region: true,
        includedCredits: true,
        creditsUsedThisCycle: true,
        creditsResetDate: true,
        notificationSettings: true,
      },
    });

    if (!user) return null;

    const limit = user.includedCredits;
    if (!Number.isFinite(limit) || limit <= 0) return null; // unlimited / অজানা

    const used = Math.max(0, user.creditsUsedThisCycle);
    const percent = Math.floor((used / limit) * 100);

    // ── কোন threshold গুলো ছোঁয়া হয়েছে ─────────────────────────────────────
    // ছোট threshold আগে পাঠানো হয় যাতে 80% → 100% ক্রম ঠিক থাকে (একসাথে
    // দুটোই ছোঁয়া থাকলে merchant আগে "প্রায় শেষ" তারপর "শেষ" বার্তা পায়)।
    const crossed = THRESHOLDS.filter((t) => percent >= t).sort((a, b) => a - b);

    if (crossed.length === 0) return outcome;

    const settings = toJsonObject(user.notificationSettings);
    const wantsEmail = settings.usage_alerts_email !== false;
    const wantsApp = settings.usage_alerts_app !== false;

    const region = (user.region || "bd") as Region;
    const upgradeUrl = buildUpgradeUrl(region, user.plan, percent);

    for (const threshold of crossed) {
      // ── In-app notification ──────────────────────────────────────────────
      if (wantsApp) {
        const claimed = await claimAlert({
          userId,
          cycleStart: user.creditsResetDate,
          threshold,
          channel: "app",
        });

        if (!claimed) {
          outcome.skipped.push({ threshold, channel: "app", reason: "already_sent" });
        } else {
          try {
            await db.notification.create({
              data: {
                userId,
                type: "usage",
                title:
                  threshold >= 100
                    ? "Credits Exhausted"
                    : `You've used ${threshold}% of your credits`,
                message:
                  threshold >= 100
                    ? "Your AI credits are exhausted — replies have stopped. Renew your plan or top up to restore service."
                    : `Only ${(limit - used).toLocaleString()} credits left this cycle. Upgrade or top up to avoid interruption.`,
              },
            });
            outcome.fired.push({ threshold, channel: "app" });
          } catch (err) {
            // Notification ব্যর্থ হলে claim মুছে ফেলা হয় যাতে cron আবার চেষ্টা করে
            await releaseAlert(userId, user.creditsResetDate, threshold, "app");
            outcome.skipped.push({ threshold, channel: "app", reason: "notify_failed" });
            console.error("[USAGE_ALERT_NOTIFY_ERROR]", err);
          }
        }
      } else {
        outcome.skipped.push({ threshold, channel: "app", reason: "disabled_by_user" });
      }

      // ── Email ────────────────────────────────────────────────────────────
      if (wantsEmail) {
        const claimed = await claimAlert({
          userId,
          cycleStart: user.creditsResetDate,
          threshold,
          channel: "email",
        });

        if (!claimed) {
          outcome.skipped.push({ threshold, channel: "email", reason: "already_sent" });
        } else {
          try {
            const { sendMail, MailTemplates } = await import("@/lib/services/mail");

            // Email-এর CTA সরাসরি gateway link নয় — merchant dashboard-এর
            // payment page-এ নিয়ে যায়, যেখানে সে plan বেছে নিতে পারে।
            // (Gateway session-নির্ভর ও expire হয়, তাই email-এ রাখা অনুচিত।)
            const result = await sendMail({
              to: user.email,
              subject:
                threshold >= 100
                  ? "Your DRIPLARE AI credits are exhausted"
                  : `You've used ${threshold}% of your DRIPLARE AI credits`,
              html: MailTemplates.usageAlert(user.name, threshold, limit, upgradeUrl),
            });

            if (result.success) {
              outcome.fired.push({ threshold, channel: "email" });
            } else {
              throw new Error("sendMail returned unsuccessful");
            }
          } catch (err) {
            await releaseAlert(userId, user.creditsResetDate, threshold, "email");
            outcome.skipped.push({ threshold, channel: "email", reason: "send_failed" });
            console.error("[USAGE_ALERT_EMAIL_ERROR]", err);
          }
        }
      } else {
        outcome.skipped.push({ threshold, channel: "email", reason: "disabled_by_user" });
      }
    }

    return outcome;
  } catch (err) {
    console.error("[USAGE_ALERT_ERROR]", err);
    return null;
  }
}

/**
 * Alert-টি "পাঠানো হয়েছে" হিসেবে দাবি করে।
 *
 * `@@unique([userId, cycleStart, threshold, channel])` constraint-এর উপর
 * ভরসা করে — ইতিমধ্যে থাকলে `P2002` throw হয় এবং `false` ফেরত আসে।
 * `cycleStart` = user-এর `creditsResetDate`, তাই প্রতি billing cycle-এ
 * স্বয়ংক্রিয়ভাবে নতুন key হয় — আলাদা cleanup লাগে না।
 */
async function claimAlert(args: {
  userId: string;
  cycleStart: Date;
  threshold: number;
  channel: AlertChannel;
}): Promise<boolean> {
  try {
    await db.usageAlert.create({ data: args });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false; // আগেই পাঠানো হয়েছে
    }
    throw err;
  }
}

/** পাঠানো ব্যর্থ হলে claim মুছে ফেলা হয়, যাতে cron আবার চেষ্টা করতে পারে। */
async function releaseAlert(
  userId: string,
  cycleStart: Date,
  threshold: number,
  channel: AlertChannel
): Promise<void> {
  try {
    await db.usageAlert.deleteMany({
      where: { userId, cycleStart, threshold, channel },
    });
  } catch (err) {
    console.error("[USAGE_ALERT_RELEASE_ERROR]", err);
  }
}

/**
 * Email-এর CTA link: merchant-এর dashboard payment page, সাথে সুপারিশকৃত
 * plan। Plan-টি region-এর তালিকা থেকে নেওয়া — hardcoded নয়।
 */
function buildUpgradeUrl(region: Region, currentPlan: string, percent: number): string {
  const base = `${getAppUrl()}/dashboard/payment`;
  const plans = getPlansForRegion(region);

  const currentIdx = plans.findIndex((p) => p.key === (currentPlan as PlanKey));
  const nextPlan = plans[currentIdx + 1];

  // সর্বোচ্চ plan-এ থাকলে upgrade করার কিছু নেই — top-up-ই একমাত্র পথ,
  // তাই কোনো plan param ছাড়া payment page-এ পাঠানো হয়।
  if (!nextPlan) return base;

  // ১০০% ছোঁয়া মানে সেবা বন্ধ — renew-ই মূল কথা, তাই plan সুপারিশ করাই যায়
  return `${base}?plan=${nextPlan.key}&reason=${percent >= 100 ? "exhausted" : "threshold"}`;
}

function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://driplare.com");

  return raw.replace(/\/+$/, "");
}

function toJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

/**
 * Cron safety net — যেসব user ব্যর্থ deduction-এর কারণে real-time hook-এ
 * ধরা পড়েনি তাদের খুঁজে বের করে যাচাই করা হয়।
 *
 * কেন দরকার: balance ঠিক শেষ হয়ে গেলে `check-and-deduct` `402` দিয়ে
 * **আগেই** থেমে যায়, তাই ১০০% ছোঁয়ার ঠিক পরে আর কোনো deduction হয় না এবং
 * hook-টিও আর fire করে না।
 */
export async function scanUsageThresholds(limit = 200): Promise<{
  scanned: number;
  alerts: number;
}> {
  const candidates = await db.user.findMany({
    where: {
      includedCredits: { gt: 0 },
      // balance প্রায় শেষ বা শেষ — সম্ভাব্য threshold-crosser
      creditsBalance: { lte: 1000 },
    },
    select: { userId: true },
    take: limit,
  });

  let alerts = 0;

  for (const candidate of candidates) {
    const outcome = await checkUsageThresholds(candidate.userId);
    if (outcome) alerts += outcome.fired.length;
  }

  return { scanned: candidates.length, alerts };
}
