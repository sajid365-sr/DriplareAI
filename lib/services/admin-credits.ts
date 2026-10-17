import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { normalizeCycle, resolvePlanExpiry } from "@/lib/domain/billing-cycle";
import {
  getPlansForRegion,
  resolvePlanKeyForRegion,
  type PlanKey,
} from "@/lib/domain/plan-config";
import { getPlanCredits } from "@/lib/domain/credit-config";
import { getTopUpCredits, getPaymentPackage } from "@/lib/domain/payment-packages";
import { reconcilePromptModeForPlan } from "@/lib/ai/plan-model-access";
import type { Region } from "@/lib/core/region";

/**
 * Admin Credit & Plan Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-এর পক্ষ থেকে credit grant/deduct, plan পরিবর্তন এবং payment grant
 * প্রয়োগের একমাত্র entry point।
 *
 * আগে এই logic দুই জায়গায় দুই রকমভাবে ছিল (`/api/admin/billing` এবং
 * `/api/admin/workspaces/[id]/action`), যার ফলে behaviour drift ও race
 * condition তৈরি হয়েছিল। এখন সব route এখানেই delegate করে।
 *
 * নীতি:
 *  - সব balance পরিবর্তন **atomic** (`increment`/`decrement`), কখনো
 *    read → compute → `set` নয় (সেটি concurrent request-এ হারিয়ে যায়)।
 *  - প্রতিটি পরিবর্তনের একটি `CreditTransaction` ledger entry থাকে,
 *    যাতে কে/কখন/কেন করেছে তা audit করা যায়।
 */

/** Ledger-এ action_type হিসেবে ব্যবহৃত মান। */
export const ADMIN_CREDIT_ACTIONS = {
  add: "admin_topup",
  deduct: "admin_deduct",
} as const;

/** যে admin এই কাজটি করছেন। */
export interface AdminActor {
  userId: string;
  email: string;
}

export class CreditAdjustmentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "INSUFFICIENT_BALANCE"
      | "INVALID_AMOUNT"
      | "INVALID_PLAN"
      | "MISSING_REASON"
  ) {
    super(message);
    this.name = "CreditAdjustmentError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Credit grant / deduct
// ─────────────────────────────────────────────────────────────────────────────

export interface AdjustCreditsArgs {
  userId: string;
  /** সর্বদা positive integer; দিক `direction` নির্ধারণ করে। */
  amount: number;
  direction: "add" | "deduct";
  /** বাধ্যতামূলক — ledger-এ audit note হিসেবে যায়। */
  reason: string;
  admin: AdminActor;
}

export interface AdjustCreditsResult {
  userId: string;
  name: string;
  email: string;
  previousBalance: number;
  newBalance: number;
  amount: number;
  direction: "add" | "deduct";
}

/**
 * একটি user-এর credit balance যোগ বা বিয়োগ করে (atomic)।
 *
 * Grant করলে `includedCredits`-ও বাড়ে, যাতে bonus credits পরবর্তী plan
 * upgrade-এ সংরক্ষিত থাকে (`finalizePayment`-এর bonus হিসাব এই field পড়ে)।
 * Deduct করলে শুধু spendable balance কমে, এবং entitlement কখনো plan-এর
 * base limit-এর নিচে নামে না।
 */
export async function adjustUserCredits(
  args: AdjustCreditsArgs
): Promise<AdjustCreditsResult> {
  const { userId, amount, direction, reason, admin } = args;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CreditAdjustmentError("Amount must be a positive integer", "INVALID_AMOUNT");
  }
  if (!reason?.trim()) {
    throw new CreditAdjustmentError(
      "An audit note / reason is required for credit adjustments",
      "MISSING_REASON"
    );
  }

  const user = await db.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      email: true,
      plan: true,
      region: true,
      creditsBalance: true,
      includedCredits: true,
    },
  });

  if (!user) {
    throw new CreditAdjustmentError("User not found", "USER_NOT_FOUND");
  }

  const previousBalance = user.creditsBalance;
  const isAdd = direction === "add";

  if (isAdd) {
    // Grant: দুই field-ই atomic increment — কোনো read-then-write নেই
    const [updated] = await db.$transaction([
      db.user.update({
        where: { userId },
        data: {
          creditsBalance: { increment: amount },
          includedCredits: { increment: amount },
        },
        select: { creditsBalance: true },
      }),
      db.creditTransaction.create({
        data: {
          userId,
          action_type: ADMIN_CREDIT_ACTIONS.add,
          credits_spent: -amount, // ঋণাত্মক = credit যোগ হয়েছে
          metadata: {
            reason: reason.trim(),
            adminId: admin.userId,
            adminEmail: admin.email,
            previousBalance,
            source: "admin_grant",
          },
        },
      }),
    ]);

    return {
      userId,
      name: user.name,
      email: user.email,
      previousBalance,
      newBalance: updated.creditsBalance,
      amount,
      direction,
    };
  }

  // ── Deduct ────────────────────────────────────────────────────────────────
  // Atomic guard: balance যথেষ্ট না হলে update-টাই match করবে না।
  // (আগের implementation `Math.max(0, balance - amount)` করে set করত —
  //  দুটি concurrent deduction-এ একটি হারিয়ে যেত।)
  const region = (user.region || "bd") as Region;
  const planFloor = getPlanCredits(user.plan, region);
  const entitlementFloor = Number.isFinite(planFloor) ? planFloor : 0;
  // Entitlement কখনো plan-এর base limit-এর নিচে নামবে না
  const entitlementDeduct = Math.max(0, user.includedCredits - entitlementFloor);
  const entitlementCut = Math.min(amount, entitlementDeduct);

  const result = await db.$transaction(async (tx) => {
    const guarded = await tx.user.updateMany({
      where: { userId, creditsBalance: { gte: amount } },
      data: {
        creditsBalance: { decrement: amount },
        ...(entitlementCut > 0
          ? { includedCredits: { decrement: entitlementCut } }
          : {}),
      },
    });

    if (guarded.count === 0) {
      // Transaction abort → ledger entry-ও লেখা হবে না
      throw new CreditAdjustmentError(
        `Insufficient balance: cannot deduct ${amount} credits`,
        "INSUFFICIENT_BALANCE"
      );
    }

    await tx.creditTransaction.create({
      data: {
        userId,
        action_type: ADMIN_CREDIT_ACTIONS.deduct,
        credits_spent: amount, // ধনাত্মক = credit বিয়োগ হয়েছে
        model_tier: "manual_adjustment",
        metadata: {
          reason: reason.trim(),
          adminId: admin.userId,
          adminEmail: admin.email,
          previousBalance,
          source: "admin_deduct",
        },
      },
    });

    return tx.user.findUniqueOrThrow({
      where: { userId },
      select: { creditsBalance: true },
    });
  });

  return {
    userId,
    name: user.name,
    email: user.email,
    previousBalance,
    newBalance: result.creditsBalance,
    amount,
    direction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Plan পরিবর্তন
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ এখানে `VALID_PLAN_KEYS = ["starter","growth","business","enterprise"]` নামে
//    `plan-config.ts:18`-এর `PLAN_KEYS`-এর একটি **দ্বিতীয় কপি** ছিল, এবং ওটিই
//    `growth`-এর ভূতটির জন্ম দিয়েছিল: `growth` ওই তালিকায় বৈধ, তাই একজন BD
//    merchant `growth_bdt` (৳৯৯৯) কিনলেই তাঁর `User.plan` হয়ে যেত `growth` —
//    অথচ BD ক্যাটালগে ওই নামে কিছু নেই, ফলে পরের প্রতিটি হিসাব
//    `getPlan("bd","growth")` করে **চুপচাপ starter** পেত। পর্দায় "GROWTH",
//    নিয়মে Starter। তালিকাটি এখন এক জায়গায়: `PLAN_KEYS`, আর কোন key কোন
//    region-এ সত্যিই আছে তার একমাত্র বিচারক `getPlanIfDefined`।

export interface SetPlanArgs {
  userId: string;
  plan: string;
  reason: string;
  admin: AdminActor;
  /** true হলে অতিরিক্ত chatbot/integration pause করা হবে (downgrade-এ)। */
  enforceLimits?: boolean;
}

export interface SetPlanResult {
  userId: string;
  name: string;
  email: string;
  previousPlan: string;
  newPlan: PlanKey;
  newIncludedCredits: number;
  direction: "upgrade" | "downgrade" | "sidegrade";
  pausedChatbots?: number;
  pausedIntegrations?: number;
  /** Pro মোড plan-এ নেই বলে যতগুলো chatbot Simple-এ ফিরেছে। */
  reconciledChatbots?: number;
}

/**
 * Admin-এর পক্ষ থেকে user-এর plan পরিবর্তন করে।
 *
 * Credits **reset** হয় (increment নয়) — নাহলে plan বদলালেই credit জমতে থাকত।
 * আগের implementation-এ একটি stale hardcoded map ছিল
 * (`{starter:500, growth:5000, pro:15000, agency:35000, enterprise:100000}`)
 * যেখানে "pro"/"agency" plan আছে যা এই প্রোডাক্টে নেই।
 * এখন `plan-config.ts` থেকেই মান আসে (region-aware)।
 *
 * ⚠️ **যাচাই এখন region-সচেতন (১৫.৪)।** আগে `plan`-কে একটি region-নিরপেক্ষ
 *    তালিকায় মেলানো হত, যেখানে `growth` বৈধ — তাই admin পর্দা থেকে (বা কোনো
 *    caller থেকে) একজন **BD** user-এর উপর `growth` বসিয়ে ভূতটি বানানো যেত।
 *    এখন নামটি `resolvePlanKeyForRegion`-এর মধ্য দিয়ে যায়: যেটি এই region-এ
 *    সত্যিই আছে সেটিই ফেরে, অবসরপ্রাপ্ত নাম হলে তার প্রতিস্থাপন (BD-তে
 *    `growth`/`pro` → `business`), আর কিছুই না হলে `null` → স্পষ্ট error।
 *    একই resolver grant path-ও ব্যবহার করে, তাই দুটো দরজা একই উত্তর দেয়।
 */
export async function setUserPlan(args: SetPlanArgs): Promise<SetPlanResult> {
  const { userId, plan, reason, admin, enforceLimits = true } = args;

  const user = await db.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      email: true,
      plan: true,
      region: true,
      includedCredits: true,
    },
  });

  if (!user) {
    throw new CreditAdjustmentError("User not found", "USER_NOT_FOUND");
  }

  const region = (user.region || "bd") as Region;

  // এই region-এর সত্যিকারের plan-গুলো — hierarchy ও error message দুটোরই
  // একমাত্র সূত্র। `PLAN_KEYS` (সব region মিলিয়ে) এখানে ব্যবহার করা যেত না,
  // কারণ তাহলে BD-তে 없는 `growth` আবার "বৈধ" হয়ে যেত।
  const regionPlanKeys = getPlansForRegion(region).map((p) => p.key);

  const planKey = resolvePlanKeyForRegion(region, plan);
  if (!planKey) {
    throw new CreditAdjustmentError(
      `Invalid plan "${plan}" for region "${region}". Valid values: ${regionPlanKeys.join(", ")}`,
      "INVALID_PLAN"
    );
  }

  const previousPlan = user.plan;

  // ⚠️ তুলনার আগে বর্তমান plan-টিকেও resolve করতে হয়: DB-তে `growth` লেখা
  //    থাকলে (legacy) ওটি এই region-এ `business`, আর ক্যাটালগের তালিকায়
  //    `indexOf("growth")` = -1 — অর্থাৎ "starter-এ নামানো" একটি *upgrade*
  //    বলে চিহ্নিত হত, pause-যুক্তি বাদ পড়ত, আর merchant-এর বাড়তি chatbot
  //    চালুই থেকে যেত।
  //
  //    একেবারে অজানা মান (যেমন ভুল বানান) হলে `-1`, অর্থাৎ upgrade ধরা হয়:
  //    দ্বিধাটি অসম — না-জানা অবস্থায় কাউকে pause করা অনুমানের উপর ভরসা করে
  //    তার সেবা বন্ধ করা, আর না-pause করা কেবল একটি সীমা দেরিতে চাপানো।
  const currentKey = resolvePlanKeyForRegion(region, previousPlan);
  const previousIdx = currentKey ? regionPlanKeys.indexOf(currentKey) : -1;
  const newIdx = regionPlanKeys.indexOf(planKey);

  const direction: SetPlanResult["direction"] =
    newIdx > previousIdx ? "upgrade" : newIdx < previousIdx ? "downgrade" : "sidegrade";

  // Downgrade হলে excess chatbot/integration pause করা দরকার — সেই logic
  // ইতিমধ্যেই `plan-downgrade.ts`-এ আছে, তাই পুনর্ব্যবহার করা হচ্ছে।
  if (direction === "downgrade" && enforceLimits) {
    const { applyDowngrade } = await import("@/lib/domain/plan-downgrade");
    const outcome = await applyDowngrade(userId, planKey);

    await logPlanChange({
      userId,
      previousPlan: user.plan,
      newPlan: planKey,
      reason,
      admin,
    });

    return {
      userId,
      name: user.name,
      email: user.email,
      previousPlan: user.plan,
      newPlan: planKey,
      newIncludedCredits: getPlanCredits(planKey, region),
      direction,
      pausedChatbots: outcome.pausedChatbots,
      pausedIntegrations: outcome.pausedIntegrations,
      reconciledChatbots: outcome.reconciledChatbots,
    };
  }

  // Upgrade / sidegrade: নতুন cycle শুরু ধরে নেওয়া হয়।
  // আগের plan-এ admin-প্রদত্ত bonus credits সংরক্ষিত থাকে।
  //
  // ⚠️ `currentKey ?? previousPlan` — legacy BD `growth` (১৫,০০০ credit)
  //    resolve হয়ে `business` (৫০,০০০) হয়, আর তখন bonus = max(0, db − ৫০,০০০)।
  //    কাঁচা মান দিলে `getPlanCredits("growth","bd")` চুপচাপ starter-এ পড়ে
  //    ১৫,০০০ ধরে নিত, অর্থাৎ ওই ১৫,০০০-ই "বাড়তি" বলে গণ্য হয়ে নতুন plan-এর
  //    উপর আবার যোগ হত — একই credit দুবার।
  const currentPlanCredits = getPlanCredits(currentKey ?? previousPlan, region);
  const bonus = Math.max(0, user.includedCredits - currentPlanCredits);
  const newPlanCredits = getPlanCredits(planKey, region);
  const newIncludedCredits = newPlanCredits + bonus;

  const nextResetDate = new Date();
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  await db.$transaction([
    db.user.update({
      where: { userId },
      data: {
        plan: planKey,
        includedCredits: newIncludedCredits,
        creditsBalance: newIncludedCredits,
        creditsUsedThisCycle: 0,
        creditsResetDate: nextResetDate,
        scheduledDowngradePlan: null,
        scheduledDowngradeAt: null,
        planExpiresAt: nextResetDate,
      },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        action_type: "plan_change_admin",
        credits_spent: 0,
        model_tier: null,
        metadata: {
          reason: reason.trim(),
          adminId: admin.userId,
          adminEmail: admin.email,
          previousPlan: user.plan,
          newPlan: planKey,
          previousIncludedCredits: user.includedCredits,
          newIncludedCredits,
        },
      },
    }),
    db.notification.create({
      data: {
        userId,
        type: "plan",
        title: "Plan Updated",
        message: `Your plan has been changed to ${planKey.toUpperCase()} by our team. You now have ${newIncludedCredits.toLocaleString()} credits.`,
      },
    }),
  ]);

  // ⚠️ downgrade শাখাটা `applyDowngrade`-এর ভেতর দিয়েই এটা সেরে ফেলে; এই
  //    শাখায় আলাদা করে ডাকার কারণ legacy ফাঁক: এমন অ্যাকাউন্ট থাকতে পারে যার
  //    plan আগেই starter, অথচ কোনো bot তখন Pro-তে সেভ করা ছিল (নিয়মটা তখন
  //    ছিল না)। plan বদল না হলেও admin-এর একটা সেভ এমন অ্যাকাউন্টকে নিয়মে
  //    ফিরিয়ে আনে — এটা idempotent, কিছু না মিললে শূন্যই ফেরে।
  const reconciledChatbots = await reconcilePromptModeForPlan(userId, planKey);

  return {
    userId,
    name: user.name,
    email: user.email,
    previousPlan: user.plan,
    newPlan: planKey,
    newIncludedCredits,
    direction,
    reconciledChatbots,
  };
}

/** Plan পরিবর্তনের audit entry (downgrade path-এ ব্যবহৃত)। */
async function logPlanChange(args: {
  userId: string;
  previousPlan: string;
  newPlan: PlanKey;
  reason: string;
  admin: AdminActor;
}) {
  await db.creditTransaction.create({
    data: {
      userId: args.userId,
      action_type: "plan_change_admin",
      credits_spent: 0,
      model_tier: null,
      metadata: {
        reason: args.reason.trim(),
        adminId: args.admin.userId,
        adminEmail: args.admin.email,
        previousPlan: args.previousPlan,
        newPlan: args.newPlan,
      } satisfies Prisma.InputJsonObject,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Payment grant — একটি paid transaction-কে credit/plan-এ রূপান্তর
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transaction-এর ধরন। `kind` column না থাকলে `metadata.kind` থেকে পড়া হয়
 * (পুরনো row-গুলোর জন্য), তারপর packageId থেকে অনুমান করা হয়।
 */
export type PaymentKind =
  | "plan" // plan purchase (checkout)
  | "topup" // paid credit pack (checkout)
  | "invoice_credits" // admin invoice → credits
  | "invoice_plan" // admin invoice → plan
  | "manual_invoice"; // পুরনো record-only invoice

export interface ApplyGrantResult {
  /** true হলে এই call-এ credit/plan প্রকৃতপক্ষে প্রয়োগ হয়েছে। */
  applied: boolean;
  kind: PaymentKind;
  plan?: string;
  creditsGranted?: number;
  /** applied false হলে কারণ। */
  reason?: "already_granted" | "duplicate" | "not_payable" | "unknown_package";
}

/**
 * Grant এড়িয়ে যাওয়ার দরকার হলে ভেতরে throw করা হয়, যাতে `$transaction`
 * commit না করে (claim-ও rollback হয়)। বাইরে এটি `ApplyGrantResult`-এ রূপান্তরিত হয়।
 */
class GrantSkipped extends Error {
  constructor(
    readonly reason: NonNullable<ApplyGrantResult["reason"]>,
    readonly kind: PaymentKind
  ) {
    super(`grant skipped: ${reason}`);
    this.name = "GrantSkipped";
  }
}

/**
 * একটি **paid** transaction-এর জন্য credit/plan প্রয়োগ করে।
 *
 * এটি একমাত্র grant path — gateway webhook (`finalizePayment`) এবং admin-এর
 * "Mark as paid" (`markInvoicePaid`) দুটোই এখানেই আসে, তাই কোনো একটি path-এ
 * নিয়ম বদলালে অন্যটিও স্বয়ংক্রিয়ভাবে বদলায়।
 *
 * **Idempotency:** grant শুরু হয় একটি atomic compare-and-set দিয়ে —
 * `updateMany({ where: { id, grantedAt: null } })`। একই webhook একসাথে দুবার
 * এলে কেবল একটি call-ই `count: 1` পায়, অন্যটি `already_granted` ফেরত দেয়।
 * (আগে `metadata.grantedAt` read-then-write করা হত, যা concurrent webhook-এ
 * credit দুবার যোগ করতে পারত।)
 *
 * Semantics (kind অনুযায়ী):
 *  - `plan` / `invoice_plan` → নতুন cycle শুরু: balance = plan credits + সংরক্ষিত bonus
 *  - `topup` / `invoice_credits` → spendable credit pack; reset-এ roll over হয়
 *  - `manual_invoice` → কিছুই apply হয় না (কেবল record)
 */
export async function applyPaymentGrant(
  transactionId: string
): Promise<ApplyGrantResult> {
  const transaction = await db.paymentTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      sessionId: true,
      userId: true,
      packageId: true,
      amount: true,
      currency: true,
      gateway: true,
      kind: true,
      metadata: true,
      paymentStatus: true,
      status: true,
    },
  });

  if (!transaction) {
    throw new CreditAdjustmentError("Transaction not found", "USER_NOT_FOUND");
  }

  const meta = isJsonObject(transaction.metadata) ? transaction.metadata : {};
  const kind = resolvePaymentKind(transaction.kind, meta, transaction.packageId);

  // record-only invoice — কোনো credit/plan apply হয় না
  if (kind === "manual_invoice") {
    return { applied: false, kind, reason: "not_payable" };
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      // ── Atomic claim — একমাত্র একটি caller এখানে জিতবে ────────────────────
      const claimed = await tx.paymentTransaction.updateMany({
        where: { id: transaction.id, grantedAt: null },
        data: { grantedAt: new Date(), grantedKind: kind },
      });

      if (claimed.count === 0) {
        throw new GrantSkipped("already_granted", kind);
      }

      const user = await tx.user.findUnique({
        where: { userId: transaction.userId },
        select: {
          userId: true,
          plan: true,
          region: true,
          includedCredits: true,
          // ⚠️ ১৫.৭ — মেয়াদ জমিয়ে দেওয়ার (`resolvePlanExpiry`) জন্য **আবশ্যক**।
          //    না থাকলে প্রতিটি নবায়ন "মেয়াদ নেই" ধরে `now + period` করত,
          //    অর্থাৎ ২৫তম দিনে টাকা দেওয়া merchant-এর ৫ দিন নীরবে জ্বলে যেত —
          //    ঠিক সেই বাগটি যেটি সারাতে এই কলামটি পড়া হচ্ছে।
          planExpiresAt: true,
        },
      });

      if (!user) {
        throw new CreditAdjustmentError("User not found", "USER_NOT_FOUND");
      }

      const region = (user.region || "bd") as Region;

      // ── Credit-only grant (top-up pack / admin invoice for credits) ───────
      //
      // ⚠️ এখানে ইচ্ছে করেই **কোনো plan-যাচাই নেই** (১৫.৩)। এই ফাংশন চলে
      //    টাকা কাটা হয়ে যাওয়ার **পরে**, gateway-এর webhook থেকে। এখানে
      //    আটকালে ফল হত: merchant-এর টাকা গেছে, credit মেলেনি — যা আসল ফাঁকটির
      //    চেয়ে খারাপ। entitlement-এর সিদ্ধান্ত তাই checkout-এ নেওয়া হয়
      //    (`isPackageAllowedForPlan`, `uddoktapay/charge`)।
      if (kind === "topup" || kind === "invoice_credits") {
        const creditsToGrant = resolveCreditsToGrant(kind, meta, transaction.packageId);

        if (!creditsToGrant || creditsToGrant <= 0) {
          throw new GrantSkipped("unknown_package", kind);
        }

        await tx.user.update({
          where: { userId: transaction.userId },
          data: { creditsBalance: { increment: creditsToGrant } },
        });

        await tx.creditTransaction.create({
          data: {
            userId: transaction.userId,
            // gateway-এর paid top-up ≠ admin-এর goodwill grant — audit-এ আলাদা
            action_type: kind === "topup" ? "credit_purchase" : "admin_topup",
            credits_spent: -creditsToGrant, // ঋণাত্মক = credit যোগ হয়েছে
            metadata: {
              transactionId: transaction.id,
              sessionId: transaction.sessionId,
              kind,
              gateway: transaction.gateway,
              creditsToGrant,
            },
          },
        });

        return {
          kind,
          creditsGranted: creditsToGrant,
          plan: user.plan,
          title: "Credits Topped Up",
          message: `${creditsToGrant.toLocaleString()} credits have been added to your balance.`,
        };
      }

      // ── Plan grant (checkout plan purchase / admin invoice for plan) ──────
      const targetPlan = resolvePlanForGrant(meta, transaction.packageId, region);
      if (!targetPlan) {
        throw new GrantSkipped("unknown_package", kind);
      }

      // বর্তমান plan-এ admin-প্রদত্ত bonus credits সংরক্ষিত রাখা হয়
      const currentPlanCredits = getPlanCredits(user.plan, region);
      const bonus = Math.max(0, user.includedCredits - currentPlanCredits);
      const newPlanCredits = getPlanCredits(targetPlan, region);
      const newIncludedCredits = newPlanCredits + bonus;

      // ── ১৫.৭: মাসিক, নাকি বার্ষিক ─────────────────────────────────────────
      //
      // ⚠️ **দুটি ঘড়ি, দুটি আলাদা মেয়াদ — এটিই এই খণ্ডের পুরো অর্থ।**
      //
      //   • `planExpiresAt` = **সেবার** মেয়াদ। বার্ষিক কেনা হলে ৩৬৫ দিন, মাসিক
      //     হলে ৩০। এই ঘড়িটিই `isResetEligible` পড়ে, অর্থাৎ মেয়াদ শেষে
      //     নবায়ন বন্ধ হয়।
      //   • `creditsResetDate` = **credit** নবায়নের তারিখ — **সবসময় ৩০ দিন**।
      //
      // ⚠️ কেন credit বার্ষিক গ্রাহকেরও মাসে মাসে আসে (ব্যবহারকারীর সিদ্ধান্ত):
      //    একবারে ১২ মাসের credit দিলে একজন merchant এক মাসেই সেটি জ্বালিয়ে
      //    ১১ মাস খালি হাতে বসে থাকতেন — অথচ তিনি পুরো টাকা দিয়েছেন। আর
      //    ৩৬৫তম দিনের আগে মেয়াদ শেষ হয় না, তাই বার্ষিক গ্রাহক ওই ১২টি cycle
      //    নিজে থেকেই পান (দেখুন `billing-cycle.ts`-এর `YEARLY_DAYS`)।
      const cycle = normalizeCycle(meta.cycle);

      // ⚠️ একটি `now` — দুই ঘড়ির ভিত্তি একই মুহূর্ত হওয়া দরকার, নইলে দুই
      //    `new Date()`-এর মাঝের কয়েক মিলিসেকেন্ডে মেয়াদ ও reset-তারিখ আলাদা
      //    মুহূর্তে গড়ে, আর "দুটো একসাথে শেষ হয়" এই সম্পত্তিটি ভাঙে।
      const grantedAt = new Date();

      // ⚠️ **স্ট্যাকিং** — `resolvePlanExpiry` = `max(now, current) + period`।
      //    অর্থাৎ ২৫তম দিনে নবায়ন করলে বাকি ৫ দিন জ্বলে যায় না, বরং যোগ হয়।
      //    আগে এখানে `now + 30` ছিল, যা ঠিক সেই দিনগুলো কেটে নিত।
      const nextResetDate = resolvePlanExpiry(grantedAt, "monthly", null);
      const nextPlanExpiry = resolvePlanExpiry(grantedAt, cycle, user.planExpiresAt);

      await tx.user.update({
        where: { userId: transaction.userId },
        data: {
          plan: targetPlan,
          includedCredits: newIncludedCredits,
          creditsBalance: newIncludedCredits,
          creditsUsedThisCycle: 0,
          creditsResetDate: nextResetDate,
          planExpiresAt: nextPlanExpiry,
          scheduledDowngradePlan: null,
          scheduledDowngradeAt: null,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: transaction.userId,
          action_type: "plan_purchase",
          credits_spent: 0,
          metadata: {
            transactionId: transaction.id,
            sessionId: transaction.sessionId,
            kind,
            gateway: transaction.gateway,
            previousPlan: user.plan,
            newPlan: targetPlan,
            newIncludedCredits,
            // ⚠️ cycle-টি লেজারে লেখা হয় — নতুন কলাম নেই, কিন্তু মাসিক না বার্ষিক
            //    সেটি পরবর্তীকালে জানার একমাত্র উপায়, আর refund/takedown
            //    তদন্তে এই একটি শব্দই ঠিক করে দেয় কত দিন ফেরত দিতে হবে।
            cycle,
            planExpiresAt: nextPlanExpiry.toISOString(),
          },
        },
      });

      return {
        kind,
        plan: targetPlan as string,
        creditsGranted: newIncludedCredits,
        title: "Plan Upgraded",
        message: `Welcome to the ${targetPlan.toUpperCase()} plan! You now have ${newIncludedCredits.toLocaleString()} credits.`,
      };
    });

    // Grant commit হওয়ার পরেই notification — ব্যর্থ হলে credit তবুও থাকবে
    await notifyGrant({
      userId: transaction.userId,
      title: outcome.title,
      message: outcome.message,
    });

    return {
      applied: true,
      kind: outcome.kind,
      plan: outcome.plan,
      creditsGranted: outcome.creditsGranted,
    };
  } catch (err) {
    if (err instanceof GrantSkipped) {
      return { applied: false, kind: err.kind, reason: err.reason };
    }
    throw err;
  }
}

/** কোন ধরনের payment — column → metadata → packageId এই ক্রমে নির্ধারিত হয়। */
function resolvePaymentKind(
  columnKind: string | null | undefined,
  meta: Prisma.JsonObject,
  packageId: string
): PaymentKind {
  const candidate = (columnKind && columnKind !== "plan" ? columnKind : asString(meta.kind)) ?? columnKind;

  if (
    candidate === "plan" ||
    candidate === "topup" ||
    candidate === "invoice_credits" ||
    candidate === "invoice_plan" ||
    candidate === "manual_invoice"
  ) {
    return candidate;
  }

  // Fallback: পুরনো row যেখানে kind column সেট হয়নি
  return packageId.startsWith("topup_") ? "topup" : "plan";
}

/** Credit-only grant-এ কত credit যোগ হবে। */
function resolveCreditsToGrant(
  kind: PaymentKind,
  meta: Prisma.JsonObject,
  packageId: string
): number | null {
  // invoice_credits → metadata থেকে (admin যত credit দিতে চেয়েছে)
  if (kind === "invoice_credits") {
    const fromMeta = Number(meta.creditsToGrant);
    return Number.isFinite(fromMeta) && fromMeta > 0 ? Math.floor(fromMeta) : null;
  }

  // topup → payment package catalog থেকে
  return getTopUpCredits(packageId);
}

/**
 * Plan grant-এ কোন plan সেট হবে — **region-সচেতন** (১৫.৪)।
 *
 * ⚠️ এখানে আগে `LEGACY_PLAN_ALIASES = { pro: "growth", agency: "enterprise" }`
 *    নামে একটি **region-নিরপেক্ষ** টেবিল ছিল, আর তার পাশে একটি region-নিরপেক্ষ
 *    `VALID_PLAN_KEYS`। দুটো একসাথে ঠিক এই কাজটি করত: একজন BD merchant
 *    `growth_bdt` (৳৯৯৯) কিনলে তাঁর `User.plan = "growth"` হয়ে যেত — এমন একটি
 *    নাম যা BD ক্যাটালগে নেই, ফলে পরের প্রতিটি হিসাব চুপচাপ starter-এর।
 *    এখন সিদ্ধান্তটি একটি জায়গায়: `resolvePlanKeyForRegion`, যেটি একই সাথে
 *    "এই region-এ আছে কি" এবং "অবসরপ্রাপ্ত নামের প্রতিস্থাপন কী" — দুটোরই
 *    উত্তর দেয়। BD-তে `growth`/`pro` → `business` (তাঁরা ৳৯৯৯/৳২,৯০০ দিয়েছেন,
 *    তাই তাঁদের একটি channel-ও যেন না ভাঙে), Global-এ `growth` → `growth`
 *    (ওখানে ওটি সত্যিই একটি plan)।
 *
 * ⚠️ **`payment-packages.ts`-এর ডেটা ইচ্ছাকৃতভাবে অপরিবর্তিত** — `growth_bdt`-এ
 *    `plan: "growth"` লেখা যা বিক্রি হয়েছিল ঠিক তাই-ই থাকে। ইতিহাস সৎ থাকুক;
 *    সিদ্ধান্ত নেওয়া হয় **ব্যবহারের সময়ে**, ডেটার ভেতরে নয়।
 *
 * @param region  transaction-এর user-এর region। এখানে অপরিহার্য — একই
 *                packageId দুই region-এ দুই plan বোঝাতে পারে।
 */
function resolvePlanForGrant(
  meta: Prisma.JsonObject,
  packageId: string,
  region: Region
): PlanKey | null {
  // metadata.plan অগ্রাধিকার পায় (invoice), না থাকলে packageId থেকে (checkout)
  const candidate = asString(meta.plan) ?? getPaymentPackage(packageId)?.plan;
  if (!candidate) return null;

  return resolvePlanKeyForRegion(region, candidate);
}

/** Grant সম্পন্ন হলে in-app notification (user-এর preference মানা হয়)। */
async function notifyGrant(args: { userId: string; title: string; message: string }) {
  try {
    const user = await db.user.findUnique({
      where: { userId: args.userId },
      select: { notificationSettings: true },
    });

    const settings = isJsonObject(user?.notificationSettings)
      ? user.notificationSettings
      : {};
    if (settings.billing_app === false) return; // explicitly বন্ধ

    await db.notification.create({
      data: {
        userId: args.userId,
        type: "plan",
        title: args.title,
        message: args.message,
      },
    });
  } catch (err) {
    // Notification ব্যর্থ হলেও payment grant সফল থাকবে
    console.error("[GRANT_NOTIFICATION_ERROR]", err);
  }
}

// ─── ছোট helper ──────────────────────────────────────────────────────────────

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
