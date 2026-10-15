import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getPlanIfDefined, getPlansForRegion, type PlanKey, type PlanConfig } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import {
  normalizeCycle,
  resolvePlanExpiry,
  type BillingCycle,
} from "@/lib/domain/billing-cycle";
import {
  discountedPrice,
  formatPrice,
  resolveListPrice,
} from "@/lib/domain/pricing-catalogue";
import {
  crossedThresholds,
  describeRenewal,
  isRenewalThreshold,
  reminderThreshold,
  resolveRenewalWindow,
} from "@/lib/domain/renewal-reminder";
import { getPricingCatalogue } from "@/lib/services/pricing-catalogue";
import { PAID_STATUSES } from "@/lib/domain/payment-status";
import type { ReminderInvoice } from "@/lib/services/mail";

/**
 * Usage Threshold Alerts
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant-এর credit ব্যবহার ৫০% · ৮০% · ৯০% · ১০০%-এ পৌঁছালে তাকে জানানো হয়,
 * যাতে সেবা বন্ধ হয়ে যাওয়ার আগেই সে renew/top-up করতে পারে।
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
 *
 * ── ১৫.৭-এ যা যোগ হলো ────────────────────────────────────────────────────────
 *  • থ্রেশহোল্ড ২টি → ৪টি (`[100, 80]` → `[100, 90, 80, 50]`): ৫০%-এ জানানোর
 *    অর্থ হলো merchant-এর হাতে একটি পূর্ণ মাস বাকি থাকতেই তিনি জানেন।
 *  • প্রতিটি email-এর ভিতরে একটি **ইনভয়েস** — plan, দাম, ছাড়, পরের মেয়াদ আর
 *    একটি Pay বাটন (নিচে `buildRenewalOffer`)।
 *  • একটি **আলাদা ট্রিগার**, শতাংশ-বহির্ভূত: "মেয়াদ শেষ হচ্ছে" (৭/৩/১ দিন)।
 *    কারণ যিনি credit ফুর করান না তিনি উপরের চারটি থ্রেশহোল্ডের একটিও ছোঁন না,
 *    অথচ `plan_expired` নিয়মে তাঁর credit নবায়ন বন্ধ হয়ে যাবে — অর্থাৎ এই
 *    email-টিই তাঁর একমাত্র নবায়নের সংকেত।
 */

/** যে threshold-গুলো monitor করা হয়, গুরুত্বের ক্রমে। */
const THRESHOLDS = [100, 90, 80, 50] as const;

type Threshold = (typeof THRESHOLDS)[number];

/** Alert-এর channel — unique constraint-এর অংশ। */
type AlertChannel = "email" | "app";

interface AlertOutcome {
  userId: string;
  fired: Array<{ threshold: number; channel: AlertChannel }>;
  skipped: Array<{ threshold: number; channel: AlertChannel; reason: string }>;
}

/**
 * একটি plan renewal-এর ইনভয়েস-তথ্য (১৫.৭)।
 *
 * ⚠️ `invoice` ও `payUrl` — দুটোই একসাথে তৈরি হয় এবং একই plan+cycle থেকে, কারণ
 *    email-এ যে দাম লেখা থাকবে গ্রাহক ঠিক **সেই কেনাকাটাতেই** যাবেন। দুটো আলাদা
 *    সূত্র থেকে এলে এমন একটি email যেত যেখানে ৳৯৯৯ লেখা, অথচ বাটনটি ৳২,৪৯৯-এর
 *    একটি plan-এ pre-select করা পেজ খোলে — প্রতিটি সংখ্যা সত্য, তবু সম্পূর্ণ
 *    প্রতারণা।
 */
interface RenewalOffer {
  planKey: string;
  cycle: BillingCycle;
  invoice: ReminderInvoice;
  payUrl: string;
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
        // ১৫.৭: ইনভয়েসে "পরের মেয়াদ" দেখানোর জন্য — এবং সেটি grant-এর হুবহু
        // একই ফাংশনে (`resolvePlanExpiry`) গোনা হয়, নইলে email একটি তারিখ
        // প্রতিশ্রুতি দিত যা সিস্টেম দেবে না।
        planExpiresAt: true,
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

    // ⚠️ ইনভয়েস-তথ্য **লুপের বাইরে একবার** — কারণ চারটি থ্রেশহোল্ডের জন্য দাম
    //    একই, আর ভিতরে রাখলে চারবার catalogue পড়া হত ও চারবার ভিন্ন ফল আসার
    //    একটি (ক্ষীণ, কিন্তু অর্থহীন) সুযোগ থাকত।
    const offer = await buildRenewalOffer(user.userId, user.plan, region, user.planExpiresAt);

    // ⚠️ ইনভয়েস না থাকলে পুরনো `buildUpgradeUrl`-এর পথে পড়া হয় — অর্থাৎ
    //    নেগোসিয়েটেড (`contact`) plan-এ যাঁর কোনো প্রকাশিত দাম নেই, তিনি
    //    একটি দামহীন email পান, বানানো একটি দাম নয়।
    const fallbackUrl = buildUpgradeUrl(region, user.plan, percent);
    const actionUrl = offer?.payUrl ?? fallbackUrl;

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
              html: MailTemplates.usageAlert(
                user.name,
                threshold,
                limit,
                actionUrl,
                offer?.invoice
              ),
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
 * Email-এর CTA link — fallback পথ (১৫.৭)।
 *
 * ⚠️ এটি এখন **দ্বিতীয়** পছন্দ: ইনভয়েস তৈরি হলে CTA আসে
 *    `buildRenewalOffer` থেকে এবং সেটি একই plan-এর নবায়নে যায়। এখানে পড়া হয়
 *    কেবল তখন, যখন ইনভয়েসই তৈরি হয়নি — অর্থাৎ নেগোসিয়েটেড (`contact`) plan,
 *    যার কোনো প্রকাশিত দাম নেই। তখন একটি দামহীন email-এ পরের ধাপ দেখানোই
 *    একমাত্র সৎ কাজ।
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

/** `LocalizedString` → এই email-এর ভাষা (ইংরেজি)। */
function englishName(value: PlanConfig["name"]): string {
  return typeof value === "string" ? value : value.en;
}

/**
 * একটি লোকালাইজড তারিখ — "15 Nov 2026"।
 *
 * ⚠️ `"en-GB"` ইচ্ছাকৃত: email-গুলো ইংরেজিতে, আর অঙ্কগুলো বাংলা করলে
 *    ("১৫ নভে ২০২৬") একটি ইংরেজি বাক্যের ভিতরে দুই ভাষা মিশে যেত। মুদ্রার
 *    চিহ্ন অবশ্য region থেকে আসে — `৳` / `$` — কারণ সেটি ভাষা নয়, টাকার নাম।
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * merchant শেষবার কোন cycle-এ কিনেছিলেন।
 *
 * ⚠️ **ডিফল্ট `monthly`**, এবং সেটি `normalizeCycle`-এর ঠিক একই কারণ: ভুল করে
 *    "বার্ষিক" ধরে নিলে একজন মাসিক গ্রাহক ১২ গুণ দামের একটি ইনভয়েস দেখতেন;
 *    ভুল করে "মাসিক" ধরলে তিনি যা প্রতি মাসে দেন ঠিক সেটিই দেখেন।
 *
 * ⚠️ কেন অনুমান নয়: একজন বার্ষিক গ্রাহককে মাসিক দাম দেখানোও একটি মিথ্যা —
 *    তিনি ৳৯৯৯ দেখে ভাবতেন এটুকুই দিতে হবে, অথচ তিনি ৳৮,৯৯১ দিয়েছিলেন। তাই
 *    যে তথ্য লেজারে আছে সেটিই পড়া হয়, আর না থাকলে (trial, admin-প্রদত্ত plan)
 *    নিরাপদ ডিফল্ট।
 */
async function lastPurchasedCycle(userId: string): Promise<BillingCycle> {
  try {
    const last = await db.paymentTransaction.findFirst({
      where: {
        userId,
        kind: { in: ["plan", "invoice_plan"] },
        paymentStatus: { in: PAID_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });

    const metadata = toJsonObject(last?.metadata);
    return normalizeCycle(metadata.cycle);
  } catch (err) {
    console.error("[USAGE_ALERT_CYCLE_LOOKUP]", err);
    return "monthly";
  }
}

/**
 * নবায়নের ইনভয়েস — দাম, ছাড় ও পরের মেয়াদ, সবই **আসল** সূত্র থেকে।
 *
 * ── তিনটি সমতা, যেগুলো ভাঙলে email-টি মিথ্যা হয়ে যায় ────────────────────────
 *  1. **দাম** — `resolveListPrice` + `discountedPrice`, অর্থাৎ হুবহু সেই দুটি
 *     ফাংশন যা checkout ও `/pricing` ব্যবহার করে। email-এ আলাদা করে দাম গড়লে
 *     admin একটি দাম বদলালে email আরেকটি দেখাত।
 *  2. **মেয়াদ** — `resolvePlanExpiry`, অর্থাৎ হুবহু সেই ফাংশন যা grant করে।
 *     এখানে `now + 30` লিখলে email যা প্রতিশ্রুতি দিত আর সিস্টেম যা দিত, ভিন্ন
 *     হত — আর সেটি টাকার প্রতিশ্রুতি।
 *  3. **Pay লিংক** — একই plan ও cycle থেকে গড়া, তাই বাটনটি ঠিক সেই কেনাকাটাতেই
 *     নেয় যার দাম উপরে লেখা।
 *
 * `null` ফেরে যখন ইনভয়েস বানানো সৎ নয়: plan অজানা (legacy key), অথবা tierটি
 * নেগোসিয়েটেড (`contact`/দাম ০) — তখন একটি দাম বানানোর বদলে ইনভয়েস বাদ দেওয়া হয়।
 */
async function buildRenewalOffer(
  userId: string,
  planKey: string,
  region: Region,
  currentExpiry: Date | null,
  reason: "threshold" | "exhausted" | "expiring" = "threshold"
): Promise<RenewalOffer | null> {
  try {
    const plan = getPlanIfDefined(region, planKey);
    if (!plan) return null;

    const catalogue = await getPricingCatalogue();
    const cycle = await lastPurchasedCycle(userId);
    const list = resolveListPrice(plan, region, cycle, catalogue, "en");

    // নেগোসিয়েটেড tier: দাম **জানা নেই** (শূন্য নয়) — তাই একটি দাম বানানো যাবে না
    if (list.isCustom || list.amount <= 0) return null;

    const checkout = discountedPrice(list.amount, region, catalogue);
    const startsFrom = new Date();
    const nextExpiry = resolvePlanExpiry(startsFrom, cycle, currentExpiry);

    const payUrl =
      `${getAppUrl()}/dashboard/payment` +
      `?plan=${encodeURIComponent(plan.key)}&cycle=${cycle}&reason=${reason}`;

    const discountAmount =
      checkout.discountAmount > 0
        ? formatPrice(checkout.discountAmount, region, "en")
        : undefined;

    return {
      planKey: plan.key,
      cycle,
      payUrl,
      invoice: {
        planName: englishName(plan.name),
        cycleLabel: cycle === "yearly" ? "Yearly" : "Monthly",
        listAmount: formatPrice(checkout.listAmount, region, "en"),
        discountAmount,
        discountLabel:
          discountAmount && checkout.discountPercent > 0
            ? `Discount (${checkout.discountPercent}%)`
            : undefined,
        finalAmount: formatPrice(checkout.finalAmount, region, "en"),
        // ⚠️ মেয়াদ আজ থেকে গোনা হয়, `creditsResetDate` থেকে নয় — কারণ
        //    নবায়নের পরে সেবার মেয়াদ কোথায় গিয়ে ঠেকে সেটিই এখানে প্রশ্ন,
        //    credit-চক্র নয় (বার্ষিক plan-এ দুটো আলাদা: ৩৬৫ দিন বনাম ৩০ দিন)।
        expiresOn: formatDate(nextExpiry),
        payUrl,
      },
    };
  } catch (err) {
    // ⚠️ ব্যর্থ হলে ইনভয়েস বাদ — email-টি তবু যায়, কারণ "তোমার credit শেষ"
    //    খবরটি ইনভয়েসের চেয়ে জরুরি। একটি ব্যর্থ দাম-পাঠ credit-শেষের বার্তা
    //    আটকে দিলে ক্ষতিটি পুরোপুরি একমুখী হত।
    console.error("[USAGE_ALERT_OFFER]", err);
    return null;
  }
}

function getAppUrl(): string {
  // Mirrors `lib/services/mail.ts`. The final fallback is the project's own
  // Vercel domain — `driplare.com` is not attached to this project, so an alert
  // email built from it would link nowhere.
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://driplare-ai.vercel.app");

  return raw.replace(/\/+$/, "");
}

function toJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

/**
 * মেয়াদ শেষ হওয়ার reminder (১৫.৭ · ধাপ D.২) — credit-নিরপেক্ষ।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ── কেন একটি **আলাদা** ফাংশন, `checkUsageThresholds`-এর একটি শাখা নয় ──────
 * দুটির ট্রিগারই আলাদা জিনিস: একটি **খরচ** মাপে (`creditsUsedThisCycle`),
 * অন্যটি **সময়** মাপে (`planExpiresAt`)। এক ফাংশনে জুড়লে এমন একটি `if`-এর
 * জন্ম হত যার এক শাখা অন্য শাখার ইনপুট ফিরিয়ে দিত, আর প্রতিটি পরিবর্তনে দুটির
 * একটি চুপচাপ ভাঙত।
 *
 * ⚠️ **Idempotency কী — ঋণাত্মক `threshold`, আর `cycleStart` = নিজের মেয়াদ।**
 * একটি মেয়াদ-reminder শতাংশ নয়, তাই সংখ্যাটি ঋণাত্মক (`-7`/`-3`/`-1`) — বিস্তারিত
 * [renewal-reminder.ts](lib/domain/renewal-reminder.ts)-এ। আর `cycleStart`-এ
 * `creditsResetDate`-এর বদলে **`planExpiresAt`** বসানো হলো, কারণ এখানে একটি
 * "চক্র" মানে credit-চক্র নয়, **plan-এর মেয়াদ**। ফলে গ্রাহক নবায়ন করলেই
 * `planExpiresAt` সরে যায় → পরের মেয়াদের জন্য তিনটি reminder আবার খোলা, এবং
 * admin হাতে মেয়াদ না বদলালে পুরনো তিনটি আবার পাঠানো হয় না।
 *
 * ⚠️ **প্রতি run-এ সর্বোচ্চ একটি email, এবং সেটি সবচেয়ে জরুরিটি।**শতাংশ-থ্রেশহোল্ডে
 *    সবগুলো পাঠানো হয়, কারণ ওখানে প্রতিটি বার্তা একটি **অবস্থা** ("তুমি ৮০%
 *    খরচ করেছ") যা সত্য থেকে যায়; এখানে প্রতিটি বার্তা সময়ের একটি **দাবি**
 *    ("৭ দিন বাকি") যা পরের দিনেই মিথ্যা হয়ে যায়। তাই cron এক সপ্তাহ বন্ধ
 *    থাকলে merchant একটি সৎ বার্তা পান ("আগামীকাল শেষ"), তিনটি অসৎ নয়।
 */
export async function checkRenewalReminder(
  userId: string
): Promise<AlertOutcome | null> {
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
        planExpiresAt: true,
        notificationSettings: true,
      },
    });

    if (!user || !user.planExpiresAt) return outcome;

    // জানালা ও জরুরি-ক্রম — সব নিয়ম domain-এ, এখানে কেবল ব্যবহার
    const window = resolveRenewalWindow(new Date(), user.planExpiresAt);
    if (!window) return outcome;

    const settings = toJsonObject(user.notificationSettings);
    const wantsEmail = settings.usage_alerts_email !== false;
    const wantsApp = settings.usage_alerts_app !== false;

    const phrase = describeRenewal(window.daysLeft);
    const cycleStart = user.planExpiresAt;
    const region = (user.region || "bd") as Region;

    if (!wantsEmail) {
      outcome.skipped.push({
        threshold: window.crossed[0],
        channel: "email",
        reason: "disabled_by_user",
      });
    } else {
      // সবচেয়ে জরুরি অদাবিকৃতটি — উপরের নোট দেখুন
      for (const threshold of window.crossed) {
        const claimed = await claimAlert({
          userId,
          cycleStart,
          threshold,
          channel: "email",
        });

        if (!claimed) {
          outcome.skipped.push({ threshold, channel: "email", reason: "already_sent" });
          continue;
        }

        try {
          const { sendMail, MailTemplates } = await import("@/lib/services/mail");
          const offer = await buildRenewalOffer(
            userId,
            user.plan,
            region,
            user.planExpiresAt,
            "expiring"
          );

          const result = await sendMail({
            to: user.email,
            subject:
              phrase.kind === "expired"
                ? "Your DRIPLARE AI plan has ended"
                : `Your DRIPLARE AI plan renews ${renewalPhraseText(phrase)}`,
            html: MailTemplates.renewalReminder({
              name: user.name,
              when: renewalPhraseText(phrase),
              isExpired: phrase.kind === "expired",
              invoice: offer?.invoice,
              payUrl: offer?.payUrl ?? `${getAppUrl()}/dashboard/payment`,
            }),
          });

          if (!result.success) throw new Error("sendMail returned unsuccessful");

          outcome.fired.push({ threshold, channel: "email" });
        } catch (err) {
          await releaseAlert(userId, cycleStart, threshold, "email");
          outcome.skipped.push({ threshold, channel: "email", reason: "send_failed" });
          console.error("[RENEWAL_REMINDER_EMAIL_ERROR]", err);
        }

        // ⚠️ এখানেই থামা — একটি run-এ একটি email। উপরের নোট দেখুন।
        break;
      }
    }

    // In-app notification — কেবল শেষ ধাপে, যখন সত্যিই সময় ফুরিয়ে এসেছে বা
    // পার হয়ে গেছে। প্রতিটি খাবি-থ্রেশহোল্ডে একটি বেল বাজানো মানে ৭ দিন বাকি
    // থাকতেই merchant-এর নোটিফিকেশন ভরে যাওয়া, যে খবরটি তখনো কাজের নয়।
    //
    // ⚠️ **claim ছাড়া এই ব্লকটি লেখা হয়েছিল, এবং সেটি একটি স্প্যাম-বাগ ছিল:**
    //    /api/usage ড্যাশবোর্ড খোলার প্রতিবারেই চলে, তাই `daysLeft <= 1` থাকা
    //    একজন merchant প্রতিটি পেজ-লোডে আরেকটি বেল পেতেন — একই খবরের ডজনখানেক
    //    কপি। email-পথে idempotency DB-level, তাই অ্যাপ-পথেও claim আবশ্যক।
    if (wantsApp && window.daysLeft <= 1) {
      const appThreshold = reminderThreshold(1);
      const appClaimed = await claimAlert({
        userId,
        cycleStart,
        threshold: appThreshold,
        channel: "app",
      });

      if (!appClaimed) {
        outcome.skipped.push({ threshold: appThreshold, channel: "app", reason: "already_sent" });
      } else {
        try {
          await db.notification.create({
            data: {
              userId,
              type: "usage",
              title:
                phrase.kind === "expired" ? "Your plan has ended" : "Your plan renews soon",
              message:
                phrase.kind === "expired"
                  ? "Your plan period has ended — credits have stopped renewing. Renew to restart your cycle."
                  : `Your plan period ends ${renewalPhraseText(phrase)}. Pay any time before then and the new days are added on top of the days you have left.`,
            },
          });
          outcome.fired.push({ threshold: appThreshold, channel: "app" });
        } catch (err) {
          await releaseAlert(userId, cycleStart, appThreshold, "app");
          console.error("[RENEWAL_REMINDER_NOTIFY_ERROR]", err);
        }
      }
    }

    return outcome;
  } catch (err) {
    console.error("[RENEWAL_REMINDER_ERROR]", err);
    return null;
  }
}

/** `RenewalPhrase` → ইংরেজি লেখা (email-গুলো ইংরেজিতে, বাকি template-গুলোর মতো)। */
function renewalPhraseText(phrase: ReturnType<typeof describeRenewal>): string {
  switch (phrase.kind) {
    case "expired":
      return phrase.daysAgo === 1 ? "yesterday" : `${phrase.daysAgo} days ago`;
    case "today":
      return "today";
    case "tomorrow":
      return "tomorrow";
    case "days":
      return `in ${phrase.days} days`;
  }
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

/**
 * Mেয়াদ-শেষের জানালায় যাঁরা আছেন — তাঁদের খুঁজে বের করা (১৫.৭)।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **আলাদা candidate তালিকা, এবং সেটিই এর পুরো কারণ।**
 * `scanUsageThresholds` `creditsBalance` দিয়ে ছাঁকে — অর্থাৎ যাঁদের credit
 * প্রায় শেষ। কিন্তু এই reminder-টির প্রয়োজন **ঠিক তাঁদের জন্য যাঁদের credit
 * শেষ হয় না**: একজন বার্ষিক merchant ৩৬৫ দিনের credit পান, মাসে মাসে renew হয়,
 * অথচ ৫০/৮০/৯০% থ্রেশহোল্ডের একটিও ছোঁন না — আর মেয়াদ শেষে তাঁর credit নবায়ন
 * বন্ধ হয়ে যায়। তিনি প্রথম তালিকায় নেই, তাই এখানে আলাদা করে খোঁজা হয়।
 *
 * ⚠️ ছাঁকনিটি প্রশস্ত করে রাখা হয়েছে (`not: null`), আর প্রকৃত জানালার হিসাব
 *    `resolveRenewalWindow`-এ — কারণ জানালাটি দুই দিকেই খোলা (৭ দিন আগে থেকে
 *    ৭ দিন পরে), আর সেটি একটি domain-নিয়ম যা test-করা আছে। এখানে SQL-এ দিন
 *    গুনলে নিয়মটি দুই জায়গায় লেখা হত।
 */
export async function scanRenewalReminders(limit = 200): Promise<{
  scanned: number;
  sent: number;
}> {
  const candidates = await db.user.findMany({
    where: { planExpiresAt: { not: null } },
    select: { userId: true },
    take: limit,
  });

  let sent = 0;

  for (const candidate of candidates) {
    const outcome = await checkRenewalReminder(candidate.userId);
    if (outcome) sent += outcome.fired.filter((f) => f.channel === "email").length;
  }

  return { scanned: candidates.length, sent };
}
