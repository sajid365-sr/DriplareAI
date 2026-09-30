import "server-only";

import { NextResponse } from "next/server";

import {
  canUseProMode,
  cheapestPaidPlan,
  type PlanKey,
} from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { db } from "@/lib/core/db";

// ══════════════════════════════════════════════════════════════════════════════
// Plan → Pro মোড — "এই plan-টা Pro-তে যেতে পারে কি না"
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ এখানে আগে ছিল plan → **মডেল** access: `ai_credit_rules`-এর প্রতিটি মডেলের
//    গায়ে `allowedPlans` বসিয়ে admin ঠিক করতেন কোন plan কোন মডেল পাবে, আর এই
//    ফাইলটা সেটা DB থেকে পড়ে রুটের প্রশ্নের উত্তর দিত।
//
//    সেটা তুলে দেওয়া হয়েছে। কারণ merchant মডেল বাছেন **tier** দিয়ে
//    (Fast / Smart / Genius), model id দিয়ে নয় — তাই plan-প্রতি মডেল বন্ধ করার
//    আসল প্রভাব পড়ত প্রিসেটের মধ্য দিয়ে, পরোক্ষে। admin পর্দায় যা দেখতেন আর
//    merchant যা পেতেন, তার মিল খুঁজতে দুটো আলাদা হিসাব মেলাতে হত।
//
//    এখন সীমানাটা এক জায়গায়, একটা প্রশ্নে: **এই plan-টা কি paid?**
//    (`canUseProMode`, `lib/domain/plan-config.ts`)
//      · Starter      → শুধু Simple (Guided)
//      · তার উপরের সব → Simple + Pro, admin-এর Merchant Active রাখা সব মডেল
//
// ⚠️ তাই এই ফাইলটা এখন DB পড়ে **না** — নিয়মটা কেবল plan-এর উপর নির্ভর করে,
//    আর সেটা caller-এর হাতেই আছে। ফলে সব ফাংশন synchronous, আর আগের
//    "DB পড়া গেল না → ৫০৩" অবস্থাটার অস্তিত্বই আর নেই। একটা failure mode কমা
//    মানে একটা কম উপায়ে merchant আটকে যেতে পারেন।
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pro মোডের সিদ্ধান্ত — এবং ইচ্ছে করেই একটা **discriminated union**।
 *
 * ⚠️ `requiredPlan` কেবল `blocked` অবস্থাতেই থাকে, তাই শুধু তখনই টাইপে আছে।
 *    আগে এটা `PlanKey | undefined` ছিল, আর তার ফলে প্রতিটি কলারকে এমন প্রশ্নের
 *    উত্তর দিতে হত যার অস্তিত্বই নেই: "allowed হলে `requiredPlan` কী হবে?"
 *    (এমনকি `resolveModelForPlan`-এর Simple শাখায় একটা বানানো plan-এর নাম
 *    বসাতে হত, যেটা কেউ পড়ত না।) এখন টাইপ নিজেই বলছে কখন কী আছে, আর
 *    `result.status === "blocked"` চেক করলেই TypeScript `requiredPlan`
 *    এনে দেয় — আলাদা `!` বা `as` লাগে না।
 */
export type ProModeAccessResult =
  /** এই plan-এ Pro চলবে। */
  | { status: "allowed" }
  /** চলবে না — Starter-এর উপরে উঠতে হবে। */
  | { status: "blocked"; requiredPlan: PlanKey };

/**
 * এই plan-টা Pro মোড পায় কি না।
 *
 * ⚠️ এখানে `promptMode` নেওয়া হয় **না** — "Pro দরকার কি না" সেটা caller-এর
 *    সিদ্ধান্ত, কারণ সেটা জায়গায় জায়গায় আলাদা: chatbot সেভ করার সময় প্রশ্নটা
 *    "merchant কি pro বেছে রেখেছেন?", আর compare রুটে প্রশ্নটা "এই সুবিধাটা
 *    কি Pro?"। দুটোকে এক ফাংশনের ভেতরে গুলিয়ে দিলে একদিন একটা বদলে গিয়ে
 *    অন্যটা পুরনো থেকে যেত।
 *
 * ⚠️ `requiredPlan` কখনো `undefined` হয় না: Starter-এর উপরে প্রতিটি region-এ
 *    অন্তত একটা paid plan আছে (`cheapestPaidPlan`), তাই "কোনো plan-এই নেই"
 *    অবস্থাটা অসম্ভব। যে অবস্থাটা আগে BD-র `growth`-কে ঘিরে ছিল — আর সেটাই
 *    `pickRequiredPlan`-কে `undefined` ফেরাতে বাধ্য করত।
 *
 * @param region `requiredPlan` সেই region-এ **সত্যিই কেনা যায়** এমন plan
 *   থেকেই বাছা হয়। নাহলে BD-র merchant-কে "Growth-এ আপগ্রেড করুন" দেখানো হত,
 *   অথচ BD-তে Growth plan-ই নেই (Global → Growth, BD → Business)।
 */
export function checkProModeAccess(plan: string, region: Region): ProModeAccessResult {
  if (canUseProMode(plan)) return { status: "allowed" };
  return { status: "blocked", requiredPlan: cheapestPaidPlan(region).key };
}

// ─── রুটের জন্য রেসপন্স ───────────────────────────────────────────────────────
//
// কয়েকটা route একই ৪০৩ পাঠায়, তাই বার্তা ও `code` এক জায়গায় রাখা হলো —
// নাহলে সবগুলোতে আলাদা আলাদা লেখা হয়ে যেত, আর ক্লায়েন্টের `code` ধরে শাখা
// করার কোনো উপায়ই থাকত না। (বার্তাগুলো ইংরেজিতে, বাকি রুটগুলোর মতোই —
// merchant-এর i18n অনুবাদ হয় ক্লায়েন্টে, `code` দেখে।)

/** Pro মোড plan-এ নেই — ৪০৩। */
export function proModeBlockedResponse(
  result: Extract<ProModeAccessResult, { status: "blocked" }>
): NextResponse {
  return NextResponse.json(
    {
      error: "Pro mode is not included in your current plan.",
      code: "PRO_MODE_NOT_IN_PLAN",
      // কোন plan-এ খোলে — ক্লায়েন্ট upgrade CTA বানানোর জন্য ব্যবহার করে।
      required_plan: result.requiredPlan,
    },
    { status: 403 }
  );
}

/**
 * একটা ফল → পাঠানোর মতো রেসপন্স, অথবা `null` (অর্থাৎ চালিয়ে যান)।
 *
 * এটাই রুটগুলোর এক লাইনের গার্ড:
 * ```ts
 * const denied = toDeniedResponse(checkProModeAccess(user.plan, region));
 * if (denied) return denied;
 * ```
 *
 * ⚠️ ইচ্ছে করেই কোনো ৫০৩ শাখা নেই। আগে DB থেকে নিয়ম পড়া হত, আর পড়তে ব্যর্থ
 *    হলে "নিয়মটা অজানা" বলে ৫০৩ যেত। এখন নিয়মটা কেবল plan-এর উপর নির্ভর করে
 *    — তাই ফেরার উপায় নেই, আর একটা failure mode কমা মানে একটা কম উপায়ে
 *    merchant আটকে যেতে পারেন।
 */
export function toDeniedResponse(result: ProModeAccessResult): NextResponse | null {
  if (result.status === "allowed") return null;
  return proModeBlockedResponse(result);
}

// ══════════════════════════════════════════════════════════════════════════════
// নিয়ম → সংরক্ষিত chatbot
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ উপরের চেকটা কেবল **অনুরোধের মুহূর্ত** দেখে, কিন্তু chatbot-এর গায়ে
//    `promptMode` আর `model` **লেখা থাকে**। plan নেমে গেলে (Starter-এ) সেই
//    লেখা আর নিয়মের সাথে মেলে না — আর তখনই সমস্যাটা চুপচাপ:
//
//    `resolveModelConfig("simple", "openai/gpt-4o")` tier-কী খুঁজে না পেয়ে
//    মডেল-আইডিটাকেই বৈধ ধরে ফেলে (নিচের `getValidatedModelId` শাখা)। অর্থাৎ
//    Simple মোডে থাকা একটা bot পুরনো Pro মডেল চালাতেই থাকত — পর্দায় কোনো
//    কার্ড উজ্জ্বল থাকত না, অথচ বিলে ভারী মডেলটাই কাটত। লুকিয়ে খরচ, ঠিক যে
//    ধরনের বাগ এড়াতে `create-agent-dialog`-এ ডিফল্ট tier-টাও সবচেয়ে সস্তা
//    রাখা হয়েছে।
//
//    তাই plan নামার সাথে সাথেই লেখাটা নিয়মে ফেরানো হয়, UI-তে ভরসা না রেখে।
// ══════════════════════════════════════════════════════════════════════════════

/**
 * নতুন Simple bot-টা যে tier-এ বসে — `create-agent-dialog`-এর ডিফল্টের সাথে
 * একই মান। সবচেয়ে সস্তা tier-টাই বাছা হয়, তাই plan নামার ধাক্কায় merchant-এর
 * credit হঠাৎ বেশি খরচ হতে পারে না।
 */
const FALLBACK_SIMPLE_TIER = "fast";

/**
 * plan বদলানোর পর যেসব chatbot এখন আর সম্ভব নয়, তাদের নিয়মে ফেরাও।
 *
 * ⚠️ কেবল **নামার** দিকে কিছু করা হয়। plan উঠলে কাউকে জোর করে Pro-তে তোলা
 *    হয় না — Pro-টা merchant-এর বাছাই, আর সেভ চাপার আগেই তাঁর পছন্দ হয়ে যাওয়া
 *    উচিত নয়। তাই upgrade-এ এটা নিছক শূন্য ফেরায়।
 *
 * ⚠️ userId ধরে চলে, workspace ধরে নয়: planটা **অ্যাকাউন্টের**, আর সব
 *    workspace-এর chatbotই একই plan-এর ছায়ায়।
 *
 * @returns কতটি chatbot বদলাতে হয়েছিল। `applyDowngrade` এই সংখ্যাটা
 *   notification-এ লেখে — নাহলে merchant হঠাৎ Fast দেখে বুঝতেই পারতেন না কেন।
 */
export async function reconcilePromptModeForPlan(
  userId: string,
  plan: string
): Promise<number> {
  if (canUseProMode(plan)) return 0;

  const { count } = await db.chatbot.updateMany({
    where: { userId, promptMode: "pro" },
    data: { promptMode: "simple", model: FALLBACK_SIMPLE_TIER },
  });

  return count;
}
