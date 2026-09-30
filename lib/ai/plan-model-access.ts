import "server-only";

import { NextResponse } from "next/server";

import { db } from "@/lib/core/db";
import { pickRequiredPlan, sanitizeAllowedPlans } from "@/lib/domain/model-catalog";
import type { PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

// ══════════════════════════════════════════════════════════════════════════════
// Plan → Model access — "এই plan-টা এই মডেলটা পাবে কি না"
//
// নিয়মটা লেখা থাকে `ai_credit_rules.value.models[].allowedPlans`-এ, আর
// শুদ্ধ যাচাইটা (`isModelAllowedForPlan`) থাকে `lib/domain/model-catalog.ts`-এ —
// কারণ admin panel-এর ক্লায়েন্টও ঠিক ওই একই ফাংশন চালায়। এই ফাইলটা কেবল
// **সেই নিয়মটা DB থেকে পড়ে** রুটের প্রশ্নের উত্তর দেয়।
//
// ⚠️ কেন আলাদা ফাইল, `credit-resolver.ts`-এ যোগ না করে: ওই ফাইলের পুরো
//    পরিচয়ই "credit-এর একমাত্র সূত্র"। plan access টাকার নিয়ম ঠিকই, কিন্তু
//    credit নয় — দুটো আলাদা প্রশ্ন একই row-তে থাকলেও।
// ══════════════════════════════════════════════════════════════════════════════

const SETTING_KEY = "ai_credit_rules";

/**
 * modelId → এই মডেলটা যে plan-গুলো পায়।
 *
 * ⚠️ শুধু **সীমাবদ্ধ** মডেলগুলোই এখানে থাকে। যা এখানে নেই তার মানে সব plan —
 *    এটাই `CatalogModelShape.allowedPlans`-এর সংজ্ঞা (অনুপস্থিত বা খালি =
 *    বাধা নেই)। তাই "নেই" আর "খালি তালিকা" গুলিয়ে ফেলা চলবে না, আর
 *    `sanitizeAllowedPlans` নিজেই খালি তালিকাকে `undefined` বানিয়ে দেয় —
 *    ফলে খালি তালিকা কখনো এই map-এ ঢুকতেই পারে না।
 */
export type ModelPlanMap = ReadonlyMap<string, readonly PlanKey[]>;

export type ModelAccessStatus =
  /** এই plan-এ মডেলটা চলে। */
  | "allowed"
  /** চলে না — admin ইচ্ছে করেই আটকেছেন। */
  | "blocked"
  /** DB পড়া গেল না, তাই নিয়মটাই অজানা। */
  | "unknown";

export interface ModelAccessResult {
  status: ModelAccessStatus;
  /** `blocked` হলে — সবচেয়ে নিচু plan যেটা এই মডেলটা পায়। */
  requiredPlan?: PlanKey;
}

/**
 * `ai_credit_rules` থেকে সীমাবদ্ধ মডেলের তালিকা।
 *
 * ⚠️ পড়তে ব্যর্থ হলে `null` — অর্থাৎ "জানি না"। এখানে খালি map ফেরানো
 *    মানে হত "কোনো সীমাবদ্ধতাই নেই", অর্থাৎ DB-র একটা ক্ষণিক হোঁচটেই plan-এর
 *    বেড়া নীরবে খুলে যেত। দুই দিকই খারাপ, কিন্তু একটা চুপচাপ নিয়ম-ভাঙা আর
 *    একটা স্পষ্ট "আবার চেষ্টা করুন" — দ্বিতীয়টাই বেছেছি। ঠিক এই যুক্তিতেই
 *    `/api/ai-models` DB পড়তে না পারলে ডিফল্ট তালিকা না দিয়ে ৫০০ দেয়।
 */
async function readModelPlanMap(): Promise<ModelPlanMap | null> {
  try {
    const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    const value: unknown = setting?.value ?? null;
    if (typeof value !== "object" || value === null) return new Map();

    const models = (value as Record<string, unknown>).models;
    if (!Array.isArray(models)) return new Map();

    const map = new Map<string, readonly PlanKey[]>();
    for (const model of models) {
      if (typeof model !== "object" || model === null) continue;

      const row = model as { id?: unknown; allowedPlans?: unknown };
      if (typeof row.id !== "string") continue;

      const allowedPlans = sanitizeAllowedPlans(row.allowedPlans);
      if (allowedPlans) map.set(row.id, allowedPlans);
    }

    return map;
  } catch (error) {
    console.error("[PLAN_MODEL_ACCESS] Failed to read model plan access:", error);
    return null;
  }
}

/**
 * একটা মডেল এই plan-এ চলে কি না — ইতিমধ্যে পড়া map থেকে।
 *
 * @param region দেওয়া থাকলে `requiredPlan` সেই region-এ **সত্যিই কেনা যায়**
 *   এমন plan-গুলোর ভেতর থেকেই বাছা হয়। নাহলে BD-র merchant-কে "Growth-এ
 *   upgrade করুন" দেখানো হত, অথচ BD-তে Growth plan-ই নেই।
 */
function verdictFrom(
  map: ModelPlanMap,
  modelId: string,
  plan: string,
  region?: Region
): ModelAccessResult {
  const allowedPlans = map.get(modelId);
  // map-এ নেই = কোনো সীমাবদ্ধতা নেই — সব plan-ই পায়।
  if (!allowedPlans) return { status: "allowed" };
  if (allowedPlans.includes(plan as PlanKey)) return { status: "allowed" };

  // `requiredPlan` না-ও থাকতে পারে — মডেলটা এই region-এ কোনো plan-এই পাওয়া যায়
  // না। তখন কলার plan-এর নাম বলবে না, শুধু "এই plan-এ নেই" বলবে।
  return { status: "blocked", requiredPlan: pickRequiredPlan(allowedPlans, region) };
}

const UNKNOWN: ModelAccessResult = { status: "unknown" };

/** একটা মডেল এই plan-এ চলে কি না। */
export async function checkModelAccess(
  modelId: string,
  plan: string,
  region?: Region
): Promise<ModelAccessResult> {
  const map = await readModelPlanMap();
  if (!map) return UNKNOWN;
  return verdictFrom(map, modelId, plan, region);
}

/**
 * একসাথে কয়েকটা মডেল — compare route-এর জন্য, যাতে DB একবারই পড়া হয়।
 *
 * একটা মডেল আটকে গেলেই **সেই ফলটাই** ফেরত আসে, কারণ কলারের কাজ কেবল
 * "আটকাতে হবে কি না" জানা, আর কোনটা আটকেছে সেটা বার্তায় বলার জন্য।
 */
export async function checkModelsAccess(
  modelIds: readonly string[],
  plan: string,
  region?: Region
): Promise<ModelAccessResult> {
  const map = await readModelPlanMap();
  if (!map) return UNKNOWN;

  for (const modelId of modelIds) {
    const result = verdictFrom(map, modelId, plan, region);
    if (result.status !== "allowed") return result;
  }

  return { status: "allowed" };
}

// ─── রুটের জন্য রেসপন্স ───────────────────────────────────────────────────────
//
// চারটা route একই ৪০৩/৫০৩ পাঠায়, তাই বার্তা ও `code` এক জায়গায় রাখা হলো —
// নাহলে চারটায় চার রকম লেখা হয়ে যেত, আর ক্লায়েন্টের `code` ধরে শাখা করার
// কোনো উপায়ই থাকত না। (বার্তাগুলো ইংরেজিতে, বাকি রুটগুলোর মতোই —
// merchant-এর i18n অনুবাদ হয় ক্লায়েন্টে, `code` দেখে।)

/** আটকানো মডেল — ৪০৩। */
export function modelBlockedResponse(result: ModelAccessResult): NextResponse {
  return NextResponse.json(
    {
      error: "This model is not included in your current plan.",
      code: "MODEL_NOT_IN_PLAN",
      // কোন plan-এ মডেলটা পাওয়া যায় — ক্লায়েন্ট upgrade CTA বানানোর জন্য
      // ব্যবহার করে। region-এ বিক্রিই না হলে বাদ পড়ে যায়।
      ...(result.requiredPlan ? { required_plan: result.requiredPlan } : {}),
    },
    { status: 403 }
  );
}

/** নিয়ম পড়া যায়নি — ৫০৩, কারণ পুনরায় চেষ্টা করলে কাজ হতে পারে। */
export function modelAccessUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Could not verify model access right now. Please try again.",
      code: "MODEL_ACCESS_UNAVAILABLE",
    },
    { status: 503 }
  );
}

/**
 * একটা ফল → পাঠানোর মতো রেসপন্স, অথবা `null` (অর্থাৎ চালিয়ে যান)।
 *
 * এটাই রুটগুলোর এক লাইনের গার্ড:
 * ```ts
 * const denied = toDeniedResponse(await checkModelAccess(model, user.plan));
 * if (denied) return denied;
 * ```
 */
export function toDeniedResponse(result: ModelAccessResult): NextResponse | null {
  if (result.status === "allowed") return null;
  if (result.status === "blocked") return modelBlockedResponse(result);
  return modelAccessUnavailableResponse();
}
