import type { TFunction } from "i18next";

import { REGION_LABEL_KEY, type DraftProblem } from "./types";

/**
 * কাঠামোবদ্ধ সমস্যা → পর্দার বাক্য (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ কেন অনুবাদ এখানে, `types.ts`-এ নয়: `types.ts` pure (কোনো React নেই, কোনো
 *    i18n নেই) — সেটিই তাকে unit test-যোগ্য রাখে। বাক্য বানানো পর্দার কাজ।
 *
 * ⚠️ `Record<DraftProblem["kind"], …>` — `switch` নয়। ইউনিয়নে একটি নতুন `kind`
 *    যোগ হলে এখানে টাইপ-ত্রুটি জন্মাবে, অর্থাৎ পর্দায় `pricing.problem.xyz`
 *    নামের কাঁচা key দেখানোর সুযোগ থাকবে না।
 */
const MESSAGE_KEY: Record<DraftProblem["kind"], string> = {
  percentRange: "pricing.problem.percentRange",
  invalidPrice: "pricing.problem.invalidPrice",
  invalidTopUpPrice: "pricing.problem.invalidTopUpPrice",
  couponCode: "pricing.problem.couponCode",
  couponDuplicate: "pricing.problem.couponDuplicate",
  couponValue: "pricing.problem.couponValue",
  couponPercentMax: "pricing.problem.couponPercentMax",
  couponMax: "pricing.problem.couponMax",
};

/** প্রতি `kind`-এর জন্য ঠিক কোন পরামিতিগুলো লাগে — সেগুলোই অনুবাদ হয়ে যায়। */
export function resolveProblem(t: TFunction, problem: DraftProblem): string {
  const key = MESSAGE_KEY[problem.kind];

  switch (problem.kind) {
    case "percentRange":
      return t(key, {
        region: t(REGION_LABEL_KEY[problem.region]),
        field:
          problem.field === "discountPercent"
            ? t("pricing.field.discount")
            : t("pricing.field.annualDiscount"),
      });

    case "invalidPrice":
      return t(key, {
        region: t(REGION_LABEL_KEY[problem.region]),
        plan: problem.plan,
        cycle: t(`pricing.cycle.${problem.cycle}`),
      });

    case "invalidTopUpPrice":
      return t(key, { package: problem.packageId });

    case "couponDuplicate":
      return t(key, { row: problem.row, code: problem.code });

    case "couponCode":
    case "couponValue":
    case "couponPercentMax":
    case "couponMax":
      return t(key, { row: problem.row });
  }
}
