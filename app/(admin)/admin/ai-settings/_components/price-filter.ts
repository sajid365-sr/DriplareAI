import { type OpenRouterModelConfig } from "@/components/admin/ai-settings/ModelConfigSheet";
import { blendedPricePerM } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// Price Filter — মডেলের দাম দেখে ফিল্টার ও সাজানো
//
// দামের সংজ্ঞা একটাই: `blendedPricePerM()` — prompt ও completion-এর গড়, প্রতি
// 1M token-এ। এটাই `fetch-models` route tier ঠিক করার সময় ব্যবহার করে, তাই
// দামের ক্রম আর tier-এর ক্রম কখনো বিরোধ করবে না।
// ══════════════════════════════════════════════════════════════════════════════

/** Catalogue-এর সাজানোর ধরন। `default` = অ্যাডমিন যা সাজিয়েছেন সেই ক্রম। */
export type PriceSort = "default" | "low-high" | "high-low";

/** দামের সীমা — USD প্রতি 1M token (prompt + completion-এর গড়)। */
export type PriceRange = "all" | "under-1" | "1-to-5" | "above-5";

const RANGE_BOUNDS: Record<Exclude<PriceRange, "all">, { min: number; max: number }> = {
  "under-1": { min: 0, max: 1 },
  "1-to-5": { min: 1, max: 5 },
  "above-5": { min: 5, max: Number.POSITIVE_INFINITY },
};

/**
 * মডেলটা বেছে নেওয়া দামের সীমার মধ্যে পড়ে কি না।
 *
 * নিচের সীমা ধরা হয়, উপরেরটা ধরা হয় না — তাই `$1.00` কেবল `$1–$5` ব্যান্ডেই
 * পড়ে। ফলে কোনো মডেল একইসাথে দুই ব্যান্ডে গুনে যাওয়ার সুযোগ নেই, আর
 * "Under $1" + "$1–$5" + "Above $5" মিলে ঠিক পুরো তালিকাই হয়।
 */
export function matchesPriceRange(
  model: Pick<OpenRouterModelConfig, "promptPrice" | "completionPrice">,
  range: PriceRange
): boolean {
  if (range === "all") return true;

  const price = blendedPricePerM(model);
  const { min, max } = RANGE_BOUNDS[range];
  return price >= min && price < max;
}

/**
 * তালিকাটা দাম অনুযায়ী সাজায়।
 *
 * ⚠️ আগে কপি করা হয় — ইনপুট অ্যারেটা সরাসরি React state থেকে আসে, সেটা
 *    জায়গায় জায়গায় (`Array.prototype.sort`) বদলে ফেলা চলবে না।
 */
export function sortByPrice(
  models: OpenRouterModelConfig[],
  sort: PriceSort
): OpenRouterModelConfig[] {
  if (sort === "default") return models;

  const direction = sort === "low-high" ? 1 : -1;
  return [...models].sort(
    (a, b) => (blendedPricePerM(a) - blendedPricePerM(b)) * direction
  );
}
