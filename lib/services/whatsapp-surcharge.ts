import "server-only";

import { db } from "@/lib/core/db";
import { getCreditRules } from "@/lib/ai/credit-resolver";
import { getPlanCredits } from "@/lib/domain/credit-config";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import { resolveListPrice } from "@/lib/domain/pricing-catalogue";
import { getPricingCatalogue } from "@/lib/services/pricing-catalogue";
import {
  bdtPerCreditFrom,
  currentWhatsappCycleStart,
  whatsappSurchargeCredits,
} from "@/lib/domain/whatsapp-cost";
import type { Region } from "@/lib/core/region";

// ══════════════════════════════════════════════════════════════════════════════
// WhatsApp Surcharge — Meta-র service-message খরচ credit-এ ফোল্ড করা (১৫.৮)
// ══════════════════════════════════════════════════════════════════════════════
//
// ২০২৬-১০-০১ থেকে Meta service message-ও billable। merchant-এর সাথে দাম
// ইতিমধ্যেই plan-এ ঠিক হয়ে গেছে, তাই আলাদা বিল পাঠানো যেত না — বদলে প্রতিটি
// বিল-যোগ্য WhatsApp reply-তে বাড়তি credit কাটা হয়।
//
// ⚠️ **এই ফাইলের একমাত্র caller [`charge-usage.ts`](../ai/charge-usage.ts)**,
//    এবং সেটি কেবল `channel === "whatsapp"` ও নন-টেস্ট-চ্যাটে ডাকে। বিধিটি
//    ইচ্ছে করেই এখানে নয়, কারণ এখানে "কত" হিসাব হয় — "কখন" নয়।
//
// ── যে দুটি জিনিস এই ফাংশন নিজে সিদ্ধান্ত নেয় না (এবং সেটাই সঠিক) ──────────
//   ১. **ডিফল্টে বন্ধ।** `whatsappFeeBdtPerMessage` শূন্য হলে এখানে থেমে যাওয়া
//      হয় *কোনো query ছাড়াই*। কারণ চালু না থাকলে প্রতিটি WhatsApp reply-তে
//      দুটি বাড়তি DB read করা অর্থহীন — আর DB সিঙ্গাপুরে, অ্যাপ অন্য অঞ্চলে।
//   ২. **শূন্য-দামের plan-এ কখনো নয়।** `bdtPerCreditFrom` শূন্য ফেরালে
//      (Global-এর free Starter, বা `contact: true` plan) surcharge শূন্য —
//      যে plan-এর জন্য merchant কিছুই দেননি, সেখানে ভাগ করে নেওয়ার প্রশ্নই নেই।
// ══════════════════════════════════════════════════════════════════════════════

/**
 * একটি WhatsApp reply-র জন্য বাড়তি credit — ফ্রি tier পার হলে।
 *
 * @param userId   credit-দাতা merchant (⚠️ `chatbotId` থেকে বের করা আসলটি)
 * @param chatbotId যে bot থেকে বার্তাটি গেল — **free-tier-এর হিসাব এই একটি
 *                  `chatbotId` ধরে**, কারণ Meta ফ্রি tier প্রতি **নাম্বরে**, আর
 *                  একটি chatbot ≈ একটি integration ≈ একটি নাম্বার
 * @param now      পরীক্ষার জন্য ইনজেক্ট করা (ডিফল্ট: এখন)
 *
 * @returns কাটার মতো credit, বা `0` (বন্ধ / ফ্রি tier-এর ভেতরে / অজানা plan)
 */
export async function whatsappSurcharge(
  userId: string,
  chatbotId: string,
  now: Date = new Date()
): Promise<number> {
  try {
    // ── ১. কনফিগ — বন্ধ থাকলে এখানেই শেষ, কোনো query নয় ─────────────────────
    const rules = await getCreditRules();
    if (rules.whatsappFeeBdtPerMessage <= 0) return 0;

    // ── ২. চক্রে এই bot থেকে যতটি WhatsApp বার্তা **আগেই** গেছে ──────────────
    // ⚠️ এখানে "আগেই" শব্দটি মূল: বর্তমান বার্তার `AIUsageLog` row-টি তোলে
    //    `chargeUsage`-এর লেনদেনের **শেষ ধাপে**, অর্থাৎ এই `count()` তার
    //    থেকে সবসময় একটি কম গোনে। তার ফলেই সীমানাটি ঠিক বসে: আগের ৯৯৯টি
    //    বিনামূল্যে, ১০০০তমটিও বিনামূল্যে (কারণ তার আগে ৯৯৯টি), আর
    //    ১০০১তমটি বিল-যোগ্য।
    //
    //    ⚠️ **এই মন্তব্যটি মুছবেন না।** এটিকে "off-by-one বাগ" ভেবে "ঠিক"
    //       করে দিলে প্রতিটি merchant ফ্রি tier-এর ঠিক একবারই ভুল পাবেন।
    const cycleStart = currentWhatsappCycleStart(now);
    const messagesBeforeThisOne = await db.aIUsageLog.count({
      where: {
        chatbotId,
        channel: "whatsapp",
        createdAt: { gte: cycleStart },
      },
    });

    // ফ্রি tier-এর ভেতরে হলে plan ও ক্যাটালগ পড়ার দরকারই নেই
    if (messagesBeforeThisOne < rules.whatsappFreeMessages) return 0;

    // ── ৩. ওই merchant-এর কাছে এক credit-এর নগদ মূল্য ────────────────────────
    const user = await db.user.findUnique({
      where: { userId },
      select: { plan: true, region: true },
    });
    if (!user) return 0;

    const region = (user.region || "bd") as Region;
    const plan = getPlan(region, user.plan as PlanKey);

    // ⚠️ **ইচ্ছে করে `resolveListPrice`** — ক্যাটালগে admin-এর বসানো দামটিই
    //    এখানে লাগে, কোডের ডিফল্ট নয়। নইলে admin দাম বদলালে এই সংখ্যাটি মিথ্যা
    //    হয়ে যেত, অথচ হিসাবটি তখনো ঠিক দেখাত — ড্যাশবোর্ডে যা দেখানো হয় তার
    //    সাথে মিলত না।
    //
    // ⚠️ মাসিক চক্র ধরা হয়, merchant-এর আসল চক্র নয় — বরং **এটি সচেতন**, এবং
    //    ভুলটি আমাদের দিকে: বার্ষিক merchant-এর credit ২৫% সস্তা, তাই তাঁর
    //    প্রকৃত খরচ মাসিক হিসাবে বেশি credit হত। অর্থাৎ আমরা কিছুটা কম
    //    উদ্ধার করি, বেশি নয় — আর "কম নেওয়া"-ই এই নকশার ঘোষিত পক্ষপাত।
    //    আসল চক্র ধরতে প্রতি reply-তে আরেকটি query লাগত (`metadata.cycle`)।
    //    `lang` কেবল লেবেল বানায়, যা এখানে ফেলে দেওয়া হয় — তাই `"en"`।
    const catalogue = await getPricingCatalogue();
    const listAmount = resolveListPrice(plan, region, "monthly", catalogue, "en").amount;
    const includedCredits = getPlanCredits(user.plan, region);

    return whatsappSurchargeCredits({
      messagesBeforeThisOne,
      feePerMessageBdt: rules.whatsappFeeBdtPerMessage,
      bdtPerCredit: bdtPerCreditFrom(listAmount, includedCredits),
      freeMessages: rules.whatsappFreeMessages,
    });
  } catch (err) {
    // ⚠️ ব্যর্থতা গিলে ফেলা হয়, ছোড়া হয় না — কারণ একটি surcharge হিসাব না
    //    পারলে গ্রাহকের reply থেমে যাওয়া চলবে না। reply-র চেয়ে বিল কম জরুরি;
    //    আর এখানে বিল কম এলে ভুলটি আমাদের দিকে (undercharge)।
    console.error("[WHATSAPP_SURCHARGE]", err);
    return 0;
  }
}
