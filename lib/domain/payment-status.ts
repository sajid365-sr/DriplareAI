/**
 * Paid statuses — DRIPLARE AI
 * ─────────────────────────────────────────────────────────────────────────────
 * "টাকা এসেছে" বলতে কী বোঝায় — তার **একমাত্র** সংজ্ঞা।
 *
 * ⚠️ কেন এটি `payment-issues.ts`-এ থাকল না (১৫.৯): ওই ফাইলটি
 *    `import "server-only"` + `db`, অর্থাৎ তার ভেতরের কিছুই unit test-এ
 *    import করা যায় না। কিন্তু reset-এর নিয়মটি ("এই user কি plan payment
 *    করেছে?") অবশ্যই পরীক্ষাযোগ্য হতে হবে — ওটিই সেই ঢাকনা যা মাসে ৳৯০,০০০
 *    credit leak বন্ধ করে। তাই সংজ্ঞাটি এখানে: pure, `server-only` ছাড়া,
 *    DB ছাড়া। `payment-issues.ts` এটি re-export করে, তাই বর্তমান সব consumer
 *    (admin panel, `scripts/pricing-research.ts`) আগের path-এই পড়তে থাকে —
 *    ওখানে দ্বিতীয় কোনো কপি জন্মায় না।
 *
 * ⚠️ তিনটি status কেন: gateway ভিন্ন ভিন্ন শব্দ ব্যবহার করে — UddoktaPay
 *    "completed", Stripe "succeeded"/"paid"। কেবল একটিকে ধরলে gateway বদলানোর
 *    দিনে প্রতিটি payment চুপচাপ "কেনা হয়নি" বলে গণ্য হত, আর তার ফল হিসেবে
 *    পরিশোধকারীদের credit নবায়ন বন্ধ হয়ে যেত।
 */
export const PAID_STATUSES: string[] = ["paid", "completed", "succeeded"];
