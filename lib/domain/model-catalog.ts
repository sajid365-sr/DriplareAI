/**
 * LLM মডেল ক্যাটালগের শেয়ার্ড নিয়ম — এবং একদম নতুন ইনস্টলের প্রাথমিক (seed) তালিকা।
 *
 * ⚠️ এই ফাইলটা ইচ্ছে করেই client-safe (কোনো `server-only` নেই)। admin panel-এর
 *    ক্লায়েন্ট আর API route-এর সার্ভার — দুই জায়গাতেই একই নিয়ম চলতে হবে।
 *    নাহলে ক্লায়েন্ট একটা মানে, সার্ভার আরেকটা মানে, আর দুইয়ের ফাঁক দিয়ে
 *    admin নিয়ম ভাঙতে পারবেন।
 *
 * নিয়ম দুটো:
 *   ১. কমপক্ষে {@link MIN_ACTIVE_MODELS}-টা মডেল Merchant Active থাকতেই হবে।
 *   ২. Fast / Smart / Genius — এই তিনটি প্রিসেটের মডেল অবশ্যই ওই Active
 *      তালিকার ভেতর থেকে বাছা হতে হবে।
 */

import { PLAN_KEYS, type PlanKey } from "./plan-config";

// ─── নিয়ম ────────────────────────────────────────────────────────────────────

/** merchant ড্যাশবোর্ডে সবসময় অন্তত এই সংখ্যক মডেল বেছে নেওয়ার সুযোগ থাকবে। */
export const MIN_ACTIVE_MODELS = 5;

export const PRESET_KEYS = ["fastModel", "smartModel", "geniusModel"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

/**
 * প্রিসেটের প্রদর্শন-নাম। AGENTS.md §4 অনুযায়ী Fast / Smart / Genius
 * ব্র্যান্ড-টার্ম — বাংলা অনুবাদেও ইংরেজিতেই থাকে, তাই এখানে হার্ডকড করাই ঠিক।
 * (সার্ভারে কখনো UI টেক্সট রেন্ডার হয় না, তাই অনুবাদযোগ্য হওয়ার দরকার নেই।)
 */
export const PRESET_LABELS: Record<PresetKey, string> = {
  fastModel: "Fast",
  smartModel: "Smart",
  geniusModel: "Genius",
};

/**
 * "Merchant Active" মানে শুধু টগল অন নয় — মডেলটা ডিপ্রিকেটও হতে পারবে না।
 * এই শর্তটা আগে চার জায়গায় হাতে লেখা ছিল; এখন একটাই সংজ্ঞা।
 */
export interface CatalogModelShape {
  id: string;
  isMerchantActive?: boolean;
  isDeprecated?: boolean;
  /**
   * কোন কোন plan এই মডেলটা ব্যবহার করতে পারবে।
   *
   * ⚠️ না থাকলে বা খালি হলে — **সব plan**। এটাই ইচ্ছাকৃত, আর এটাই
   *    `PlanConfig.allowedPlatforms`-এর প্রচলিত অর্থ ("খালি = বাধা নেই")।
   *    ফলে এই ফিল্ড যোগ করলে পুরনো কোনো row-তে কিছুই বদলায় না, আর
   *    "কোনো plan-ই পারবে না" বলার দরকার হলে সেটা `isMerchantActive: false`
   *    দিয়েই বলা হয় — দুটো আলাদা প্রশ্ন, দুটো আলাদা ফিল্ড।
   *
   * ⚠️ "সর্বনিম্ন plan" নয়, বরং plan-এর স্পষ্ট তালিকা। কারণ `growth` plan
   *    কেবল Global-এ আছে; minimum দিলে BD-র business user আর Global-এর
   *    business user একই শর্তে দুই রকম ফল পেত।
   */
  allowedPlans?: readonly PlanKey[];
}

export function isActiveModel(model: CatalogModelShape): boolean {
  return model.isMerchantActive === true && model.isDeprecated !== true;
}

/**
 * এই plan-টা মডেলটা বেছে নিতে পারবে কি না।
 *
 * এটা `isActiveModel`-এর বিকল্প নয় — দুটো আলাদা প্রশ্ন। "মডেলটা বিক্রির
 * যোগ্য কি না" (`isActiveModel`) আর "এই ক্রেতার জন্য যোগ্য কি না" — একসাথে
 * দরকার হলে {@link isActiveModelForPlan}।
 */
export function isModelAllowedForPlan(
  model: Pick<CatalogModelShape, "allowedPlans">,
  plan: string
): boolean {
  const allowed = model.allowedPlans;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(plan as PlanKey);
}

/** Merchant বাছতে পারবেন কি না — active, এবং তাঁর plan-এ অনুমোদিত। */
export function isActiveModelForPlan(
  model: CatalogModelShape,
  plan: string
): boolean {
  return isActiveModel(model) && isModelAllowedForPlan(model, plan);
}

/**
 * ক্লায়েন্ট বা DB থেকে আসা `allowedPlans` → নিরাপদ, ক্রমবদ্ধ তালিকা।
 *
 * SSR/`any` ছাড়া যাচাই করার জন্য `unknown` নেয়, কারণ এই মানটা দুটো অবিশ্বাস্য
 * পথ দিয়ে আসে: admin-এর ব্রাউজার, আর DB-তে হাতে লেখা JSON।
 *
 * অজানা plan key **বাদ পড়ে** — ভুল করে `"premium"` লেখা থাকলে সেটা গৃহীত
 * হওয়ার চেয়ে বাদ পড়াই ভালো, নাহলে কেউ হয়তো ভাবতেন ওই plan-টা বাধা পাচ্ছে
 * অথচ আসলে কিছুই বদলায়নি। ডুপ্লিকেট বাদ যায়, আর ক্রম সবসময় `PLAN_KEYS`-এর
 * ক্রম — তাই একই সেট কখনো দুই রকম JSON দেয় না (`isDirty` তুলনার জন্য জরুরি)।
 */
export function sanitizeAllowedPlans(value: unknown): PlanKey[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const picked = new Set<PlanKey>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const key = entry.trim().toLowerCase() as PlanKey;
    if (PLAN_KEYS.includes(key)) picked.add(key);
  }

  // খালি সেট = "বাধা নেই" — ফিল্ডটা একেবারে না থাকাই তার সঠিক প্রকাশ।
  return picked.size === 0 ? undefined : PLAN_KEYS.filter((key) => picked.has(key));
}

export function countActiveModels(models: CatalogModelShape[]): number {
  return models.filter(isActiveModel).length;
}

// ─── যাচাই ────────────────────────────────────────────────────────────────────

export type CatalogViolation =
  | { code: "too-few-active"; activeCount: number; required: number }
  | { code: "preset-inactive"; presetLabel: string; modelId: string };

/**
 * প্রস্তাবিত ক্যাটালগটা নিয়ম মানে কি না — না মানলে কারণ ফেরত দেয়, নাহলে `null`।
 *
 * ⚠️ ক্রমটা ইচ্ছাকৃত: সংখ্যার নিয়মটা আগে দেখা হয়। এটাই মূল নিয়ম, আর admin
 *    যখন ৫-এর নিচে নামাতে যান তখন সবচেয়ে কাজের বার্তাটা এটাই।
 *
 * ইচ্ছে করেই যা ধরা হয় **না**: প্রিসেটের মডেলটা ক্যাটালগে না থাকলে (যেমন
 * "Fetch Models"-এর পর মডেলটা OpenRouter থেকে হারিয়ে গেল) কিছুই ফেরত আসে না।
 * ওটা admin-এর ভুল নয় — বাইরের দুনিয়ার পরিবর্তন — তাই সেভ আটকানো অন্যায় হবে।
 * ওই অবস্থার জন্য `QuickSetupPresets`-এ আলাদা সতর্কবার্তা আগে থেকেই আছে
 * (`presets.notInCatalog`), আর `buildDynamicTierMap` নিজেই বিকল্প মডেল বেছে নেয়।
 */
export function validateModelCatalog(input: {
  models: CatalogModelShape[];
  quickSetup?: Partial<Record<PresetKey, string>> | null;
}): CatalogViolation | null {
  const activeCount = countActiveModels(input.models);

  if (activeCount < MIN_ACTIVE_MODELS) {
    return { code: "too-few-active", activeCount, required: MIN_ACTIVE_MODELS };
  }

  for (const key of PRESET_KEYS) {
    const modelId = input.quickSetup?.[key]?.trim();
    if (!modelId) continue;

    const model = input.models.find((m) => m.id === modelId);
    // ক্যাটালগে নেই → বাইরের পরিবর্তন, আটকানো হবে না (উপরের নোট দেখুন)।
    if (!model) continue;

    if (!isActiveModel(model)) {
      return { code: "preset-inactive", presetLabel: PRESET_LABELS[key], modelId };
    }
  }

  return null;
}

/**
 * `CatalogViolation` → i18n key (উপরে `aiSettings.catalogRules.*`)।
 *
 * violation অবজেক্টটা সরাসরি `t()`-এর values হিসেবে দেওয়া হয় — তাই
 * `{{required}}`, `{{activeCount}}`, `{{presetLabel}}` আপনাআপনি বসে যায়।
 */
export const CATALOG_VIOLATION_I18N: Record<CatalogViolation["code"], string> = {
  "too-few-active": "aiSettings.catalogRules.tooFewActive",
  "preset-inactive": "aiSettings.catalogRules.presetInUse",
};

// ─── প্রাথমিক (seed) ক্যাটালগ ─────────────────────────────────────────────────

/**
 * `ai_credit_rules` row-টা যখন **একদমই নেই** (নতুন ইনস্টল) তখন ব্যবহার হয়।
 *
 * ⚠️ এটা কোনো "fallback" নয়। আগে merchant route-এ আলাদা একটা হার্ডকড তালিকা
 *    ছিল যেটা active লিস্ট **খালি হলেই** ঢুকে পড়ত — ফলে admin সব মডেল বন্ধ
 *    করলে তার কোনো প্রভাবই পড়ত না। ওই সিস্টেম তুলে দেওয়া হয়েছে।
 *    এখন নিয়ম:
 *
 *      row নেই              → এই seed-টাই প্রথম মান (এখান থেকেই admin panel
 *                             প্রথমবার সেভ করলে row তৈরি হয়)
 *      row আছে কিন্তু খালি  → খালিই সত্যি, কোনো seed বসবে না
 *
 * তালিকাটা নিজেই নিজের নিয়ম মানে — ৬টি মডেলই Active, আর তিনটি প্রিসেটের
 * মডেলও এই ছয়টির ভেতরেই আছে। (`validateModelCatalog` দিয়ে যাচাইযোগ্য।)
 *
 * এখানেই একমাত্র কপি — এডমিন route আর merchant route দুটোই এটা পড়ে।
 * (আগে দুই জায়গায় দুই রকম তালিকা ছিল, যা finding G-তে ধরা পড়েছিল।)
 */
export interface SeedModel {
  id: string;
  name: string;
  provider: string;
  tier: "Economy" | "Standard" | "Premium";
  promptPrice: number;
  completionPrice: number;
  credits: number;
  isMerchantActive: boolean;
  /**
   * আজ কোনো seed মডেল সীমাবদ্ধ নয়, তাই সবগুলোতেই ফিল্ডটা অনুপস্থিত — কিন্তু
   * টাইপে থাকা দরকার: `isModelAllowedForPlan`-এর প্যারামিটার একটা "দুর্বল টাইপ"
   * (সব ফিল্ড ঐচ্ছিক), আর TS দুর্বল টাইপে এমন অবজেক্ট দিতে দেয় না যার সাথে
   * মিলে এমন একটা ফিল্ডও নেই। ফিল্ডটা এখানে না থাকলে
   * `isModelAllowedForPlan(DEFAULT_MODELS_CATALOG[0], …)` কম্পাইলই হত না।
   */
  allowedPlans?: readonly PlanKey[];
  contextWindow: number;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_MODELS_CATALOG: SeedModel[] = [
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
    tier: "Economy",
    promptPrice: 0.075,
    completionPrice: 0.3,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 1000000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "Standard",
    promptPrice: 0.1,
    completionPrice: 0.4,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 1000000,
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "Standard",
    promptPrice: 0.15,
    completionPrice: 0.6,
    credits: 3,
    isMerchantActive: true,
    contextWindow: 128000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "Premium",
    promptPrice: 2.5,
    completionPrice: 10.0,
    credits: 5,
    isMerchantActive: true,
    contextWindow: 128000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "Premium",
    promptPrice: 3.0,
    completionPrice: 15.0,
    credits: 5,
    isMerchantActive: true,
    contextWindow: 200000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "Economy",
    promptPrice: 0.14,
    completionPrice: 0.28,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 64000,
    maxTokens: 4096,
    temperature: 0.7,
  },
];

export const DEFAULT_QUICK_SETUP: Record<PresetKey, string> = {
  fastModel: "google/gemini-2.5-flash-lite",
  smartModel: "openai/gpt-4o-mini",
  geniusModel: "openai/gpt-4o",
};
