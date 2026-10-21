import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { type Region } from "@/lib/core/region";
import { normalizeCycle } from "@/lib/domain/billing-cycle";
import { getPaymentPackage, isPackageAllowedForPlan } from "@/lib/domain/payment-packages";
import { getPlanIfDefined } from "@/lib/domain/plan-config";
import {
  findCoupon,
  normalizeCatalogue,
  resolveCheckoutAmount,
  resolveListPrice,
  resolveTopUpPrice,
  validateCoupon,
  type PricingCatalogue,
} from "@/lib/domain/pricing-catalogue";
import { countCouponRedemptions, getPricingCatalogue } from "@/lib/services/pricing-catalogue";

/**
 * Coupon preview (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **এই endpoint-এর একমাত্র কারণ ব্যবহারযোগ্যতা, নিরাপত্তা নয়।** ছাড়ের
 *    প্রকৃত হিসাব সবসময় [`charge`](app/api/payments/uddoktapay/charge/route.ts)-এ
 *    হয়; এখানে কিছুই লেখা হয় না, আর এখানকার উত্তরের উপর কিছু নির্ভর করে না।
 *    যা করে তা কেবল একটি: merchant checkout-এ কোড লিখে **সাথে সাথে** দেখতে পান
 *    "২০% ছাড় — ৳৭৯৯" — নইলে তিনি কোড লিখে কিছুই দেখতেন না, "কুপন কোড
 *    চেকআউটে" চাওয়াটি অর্ধেক অসম্পূর্ণ থাকত, আর ভুল কোডের খবর পেতেন কেবল
 *    gateway-এ পৌঁছে।
 *
 * ⚠️ এখানকার দাম **charge-route-এর ঠিক একই ফাংশন** দিয়ে গণনা করা হয়
 *    (`resolveListPrice` + `resolveCheckoutAmount`)। একটি সরলীকৃত হিসাব এখানে
 *    লিখলে দুই পর্দা দুই দাম দেখাত — ঠিক যে বাগটি এড়াতে ওই ফাংশনদুটি pure
 *    domain module-এ রাখা হয়েছে।
 *
 * ⚠️ POST, GET নয়: একটি কুপন কোড URL-এ গেলে server log, browser history, আর
 *    Referer — তিন জায়গায় থেকে যায়। আর server-side পড়া দরকার, কারণ কুপন
 *    তালিকা কখনো client-এ পাঠানো হয় না (`toPublicCatalogue`)।
 */

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const packageId = String(body.package_id ?? "");
    const code = String(body.coupon_code ?? "");
    const cycle = normalizeCycle(body.cycle);
    const region = (user.region || "bd") as Region;

    const paymentPackage = getPaymentPackage(packageId);
    if (!paymentPackage || paymentPackage.currency !== "bdt") {
      return NextResponse.json({ error: "Invalid BDT package" }, { status: 400 });
    }

    // ⚠️ entitlement gate-টি এখানেও, charge-route-এর মতোই। নইলে একটি কুপন
    //    এমন pack-এ ছাড় দেখাত যা ওই merchant কিনতেই পারেন না — অর্থাৎ একটি
    //    মিথ্যা ভালো খবর।
    if (!isPackageAllowedForPlan(packageId, user.plan, region)) {
      return NextResponse.json({ error: "Package not available" }, { status: 403 });
    }

    const catalogue: PricingCatalogue = normalizeCatalogue(await getPricingCatalogue());
    const isTopUp = paymentPackage.isTopUp === true;
    const scope = isTopUp ? ("topup" as const) : ("plan" as const);

    // ⚠️ তালিকা-দামের ক্রমটি `charge`-route-এর সঙ্গে **হুবহু** একই: plan
    //    region-এর ক্যাটালগে থাকলে তার প্রকাশিত দাম (override বসানো), নইলে
    //    `PAYMENT_PACKAGES`-এর নিজের amount (legacy `growth_bdt`/`pro_bdt`)।
    let listAmount = paymentPackage.amount;

    if (isTopUp) {
      listAmount = resolveTopUpPrice(packageId, paymentPackage.amount, catalogue);
    } else {
      const planConfig = getPlanIfDefined(region, String(paymentPackage.plan));
      if (planConfig) {
        const resolved = resolveListPrice(planConfig, region, cycle, catalogue, "en");
        // ⚠️ নেগোসিয়েটেড tier-এর দাম **জানা নেই** — এখানে `amount` নিলে (০)
        //    ৳১ floor লেগে পর্দায় "৳১" দেখাত, যা একটি মিথ্যা দাম। তাই থামানোই
        //    সঠিক, আর `charge`-route-ও ঠিক এই উত্তরটিই দেয়।
        if (resolved.isCustom) {
          return NextResponse.json(
            { error: "This plan is priced on request — please contact us." },
            { status: 403 }
          );
        }
        listAmount = resolved.amount;
      }
    }

    const coupon = code.trim() ? findCoupon(catalogue, code) : null;

    const verdict = code.trim()
      ? validateCoupon(coupon, {
          scope,
          redemptions: await countCouponRedemptions(code),
          now: new Date(),
        })
      : null;

    // ⚠️ কুপন অবৈধ হলেও **দাম ফেরত দেওয়া হয়** — শুধু ছাড় ছাড়া। কারণ তাহলে
    //    পর্দা "কুপন খাটল না" ও "তাহলে দাম কত" দুটোই এক উত্তরে পায়, আর
    //    ব্যবহারকারীর পর্দায় পুরনো (সম্ভবত ইতিমধ্যে বদলে যাওয়া) দাম পড়ে থাকে না।
    const priced = resolveCheckoutAmount({
      listAmount,
      region,
      scope,
      catalogue,
      coupon: verdict?.ok ? coupon : null,
    });

    return NextResponse.json({
      ok: verdict?.ok ?? false,
      // ⚠️ কারণটি (`not_found` / `expired` / `limit_reached` / …) কাঁচা অবস্থায়
      //    পাঠানো হয়, পর্দার ভাষায় অনুবাদ client-এ হয় (`i18n`) — কারণ এখানে
      //    কোনো ভাষা নেই, আর server-এ একটি ইংরেজি বাক্য বানালে বাংলা পর্দায়ও
      //    সেটিই দেখাত।
      reason: verdict && !verdict.ok ? verdict.reason : null,
      code: coupon?.code ?? null,
      listAmount: priced.listAmount,
      discountAmount: priced.discountAmount,
      finalAmount: priced.finalAmount,
      discountPercent: priced.discountPercent,
      currency: "BDT",
    });
  } catch (error) {
    console.error("[COUPON_PREVIEW]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
