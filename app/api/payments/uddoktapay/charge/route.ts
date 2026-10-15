import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { type Region } from "@/lib/core/region";
import { normalizeCycle } from "@/lib/domain/billing-cycle";
import { getPaymentPackage, isPackageAllowedForPlan } from "@/lib/domain/payment-packages";
import { getPlanIfDefined } from "@/lib/domain/plan-config";
import {
  MIN_CHECKOUT_AMOUNT,
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
 * Uddoktapay checkout — দাম এখানেই নির্ধারিত হয় (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **client থেকে পাঠানো কোনো amount কখনো বিশ্বাস করা হয় না।** checkout-এ
 *    দাম দেখানো হয় client-এ (`usePricing()`), কিন্তু চার্জের সংখ্যাটি এখানে
 *    হাতে-কলমে আবার গণনা করা হয় — কারণ একটি POST request হাতে বানানো যায়,
 *    আর তাহলে যে কেউ `amount: 1` পাঠিয়ে ৳২,৪৯৯-এর plan কিনে ফেলত।
 *
 * ⚠️ **একই ফাংশন, দুই পর্দা।** পর্দায় যা দেখানো হয় (`resolveCheckoutAmount`)
 *    আর এখানে যা চার্জ করা হয় — একই pure ফাংশন, একই catalogue, একই ইনপুট।
 *    দুটি আলাদা হিসাব থাকলে সেগুলো অবশ্যই একদিন আলাদা হয়ে যেত, আর তখন merchant
 *    পর্দায় একটি দাম দেখে আরও একটি দাম দিত — যা এই প্ল্যাটফর্মে সবচেয়ে খারাপ
 *    ধরনের বাগ।
 *
 * ⚠️ সীমাটি একটি: `MIN_CHECKOUT_AMOUNT` (৳১)। ১০০% ছাড়ের কুপন দিলেও gateway-কে
 *    ০ পাঠানো যায় না — Uddoktapay শূন্য amount গ্রহণ করে না, আর ব্যর্থতাটি
 *    merchant-এর পর্দায় একটি রহস্যময় error হয়ে ফিরে আসত।
 */

/** সাড়া দেওয়ার আগে ক্যাটালগ পড়া একবারই — দুই শাখায় দুইবার নয়। */
async function readCatalogue(): Promise<PricingCatalogue> {
  // ⚠️ `getPricingCatalogue()` কখনো throw করে না — DB পড়তে ব্যর্থ হলে খালি
  //    catalogue (অর্থাৎ কোডের ডিফল্ট দাম) ফেরে। এটিই এখানে চাওয়া আচরণ: একটি
  //    সাময়িক DB সমস্যার কারণে একজন merchant কেনাকাটা করতে না পারা তার
  //    চেয়ে অনেক খারাপ ব্যাপার (default দামগুলোই আজকের আসল দাম)।
  return normalizeCatalogue(await getPricingCatalogue());
}

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { package_id, origin_url, coupon_code } = body;

    // `cycle` — অজানা/টাইপো মান মাসিক-ই থাকে (`normalizeCycle`)। বার্ষিক ধরে
    // নিলে একটি ৳৯৯৯-এর মাসিক পেমেন্ট ৩৬৫ দিনের মেয়াদ দিত।
    const cycle = normalizeCycle(body.cycle);

    const paymentPackage = getPaymentPackage(package_id);
    const region = (user.region || "bd") as Region;

    if (!paymentPackage || paymentPackage.currency !== "bdt") {
      return NextResponse.json({ error: "Invalid BDT package" }, { status: 400 });
    }

    // ── Entitlement gate (১৫.৩) ────────────────────────────────────────────
    //
    // Until now this route asked only "is this a BDT package?", so the plan
    // filter lived entirely in `TopUpCards.tsx` — a merchant could POST
    // `topup_50k_business_bdt` straight at the API and buy 50,000 credits
    // priced for a plan they are not on.
    //
    // Checked here and specifically **not** in `applyPaymentGrant`: the money
    // has already left the merchant by the time a grant runs, so a refusal
    // there would take payment and deliver nothing.
    if (!isPackageAllowedForPlan(package_id, user.plan, region)) {
      return NextResponse.json(
        { error: "This package is not available on your current plan." },
        { status: 403 }
      );
    }

    const catalogue = await readCatalogue();
    const isTopUp = paymentPackage.isTopUp === true;
    const scope = isTopUp ? ("topup" as const) : ("plan" as const);

    // ── অনুচ্ছেদ ১: তালিকা-দাম (list price) ─────────────────────────────────
    //
    // ⚠️ এখানে **দুটি** উৎস, একটি স্পষ্ট ক্রমে:
    //
    //   ১. plan-টি এই region-এর `plan-config`-এ আছে কি? থাকলে তার প্রকাশিত
    //      দাম (admin override বসানো) — অর্থাৎ পর্দায় যা দেখানো হচ্ছে ঠিক তাই।
    //   ২. না থাকলে `PAYMENT_PACKAGES`-এর নিজের amount — legacy `growth_bdt`/
    //      `pro_bdt`-এর জন্য। এগুলো কোনো region-এর ক্যাটালগেই নেই, অথচ পুরনো
    //      transaction-এর grant path এদের নামেই চলে, তাই এদের দামও লাগে।
    //
    // দুটির ক্রম উল্টো হলে admin-এর বসানো দাম পর্দায় দেখাত অথচ চার্জে পুরনো
    // দাম যেত — ১৫.৭-এর পুরো উদ্দেশ্যটাই উল্টে যেত।
    let listAmount = paymentPackage.amount;

    if (isTopUp) {
      listAmount = resolveTopUpPrice(package_id, paymentPackage.amount, catalogue);
    } else {
      const planConfig = getPlanIfDefined(region, String(paymentPackage.plan));
      if (planConfig) {
        const resolved = resolveListPrice(planConfig, region, cycle, catalogue, "en");
        // ⚠️ নেগোসিয়েটেড tier-এর দাম **জানা নেই**, শূন্য নয় (`plan-revenue.ts`-এর
        //    "unknown ≠ 0")। এখানে `resolved.amount` নিলে ৳০ চার্জ হত। উপরের
        //    entitlement gate এদের ইতিমধ্যে আটকায়, কিন্তু এই দ্বিতীয় প্রহরীটি
        //    থাকা দরকার — কারণ gate-এর নিয়ম ভবিষ্যতে বদলালে এখানে একটি নীরব
        //    শূন্য-চার্জ জন্ম নিত।
        if (resolved.isCustom) {
          return NextResponse.json(
            { error: "This plan is priced on request — please contact us." },
            { status: 403 }
          );
        }
        listAmount = resolved.amount;
      }
    }

    // ── অনুচ্ছেদ ২: ছাড় ও কুপন ─────────────────────────────────────────────
    //
    // ⚠️ `redeemedCount` কুপন-blob-এ লেখা **হয় না** — কতবার ব্যবহার হয়েছে তা
    //    অর্থের লেজার (`PaymentTransaction.metadata.couponCode`) থেকে গোনা হয়।
    //    কারণ blob-এ লিখলে দুটি tab একসাথে read-modify-write করে ব্যবহারের
    //    সংখ্যা হারাত — ঠিক যে নীতিতে `hasPaidForPlan` আলাদা flag না রেখে
    //    payment row গোনে। ফলে blob **read-only config** থাকে।
    const coupon =
      typeof coupon_code === "string" && coupon_code.trim()
        ? findCoupon(catalogue, coupon_code)
        : null;

    if (typeof coupon_code === "string" && coupon_code.trim()) {
      const verdict = validateCoupon(coupon, {
        scope,
        redemptions: await countCouponRedemptions(coupon_code),
        now: new Date(),
      });

      if (!verdict.ok) {
        // ⚠️ কারণ-অনুযায়ী আলাদা বার্তা — নইলে merchant checkout-এ আটকে থাকতেন
        //    অথচ জানতেন না কোডটি ভুল, নাকি মেয়াদোত্তীর্ণ, নাকি শেষ হয়ে গেছে।
        return NextResponse.json(
          { error: couponErrorMessage(verdict.reason) },
          { status: 400 }
        );
      }
    }

    const priced = resolveCheckoutAmount({
      listAmount,
      region,
      scope,
      catalogue,
      coupon,
    });

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const apiBase = process.env.UDDOKTAPAY_API_BASE || "https://sandbox.uddoktapay.com/api";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing UDDOKTAPAY_API_KEY" }, { status: 500 });
    }

    const origin = String(origin_url || "").replace(/\/$/, "");
    if (!origin) {
      return NextResponse.json({ error: "origin_url is required" }, { status: 400 });
    }

    const localReference = `udd_${randomUUID().replace(/-/g, "").slice(0, 14)}`;

    // ── অনুচ্ছেদ ৩: gateway ────────────────────────────────────────────────
    //
    // ⚠️ `amount` এখানে **আমাদের** হিসাব — `priced.finalAmount`। কুপন-কোড
    //    ও cycle gateway-এর metadata-তেও যায়, যাতে Uddoktapay-র dashboard-এ
    //    একটি পেমেন্ট দেখে বোঝা যায় ছাড়টি কোথা থেকে এল।
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/checkout-v2`, {
      method: "POST",
      headers: {
        "RT-UDDOKTAPAY-API-KEY": apiKey,
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        full_name: user.name || "User",
        email: user.email,
        amount: priced.finalAmount,
        metadata: {
          user_id: user.userId,
          package_id: package_id,
          plan: paymentPackage.plan,
          cycle,
          local_reference: localReference,
          ...(coupon ? { coupon: coupon.code } : {}),
        },
        redirect_url: `${origin}/dashboard/payment/success?gateway=uddoktapay`,
        cancel_url: `${origin}/api/payments/uddoktapay/cancel?reference=${encodeURIComponent(localReference)}`,
        webhook_url: `${origin}/api/payments/uddoktapay/webhook`,
      }),
    });

    const data = await response.json();
    console.log("[UDDOKTAPAY_API_RESPONSE]", data);

    if (!response.ok || !data.payment_url) {
      console.error("[UDDOKTAPAY_API_ERROR]", data);
      throw new Error(data.message || "Failed to initiate payment with Uddoktapay");
    }

    // Uddoktapay generates its own id. Fallback to various common field names.
    let invoiceId = data.invoice_id || data.payment_id || data.id;

    // If still missing, try to extract from payment_url
    if (!invoiceId && data.payment_url) {
      const parts = data.payment_url.split("/");
      invoiceId = parts[parts.length - 1];
    }

    invoiceId = String(invoiceId || `inv_${randomUUID().replace(/-/g, "").slice(0, 10)}`);

    // ── অনুচ্ছেদ ৪: আমাদের লেজার ──────────────────────────────────────────
    //
    // ⚠️ এখানে লেখা `amount` **ছাড় বাদ দেওয়ার পরের** সংখ্যা, তালিকা-দাম নয়।
    //    কারণ এই row-ই revenue হিসাবের ভিত্তি (`plan-revenue.ts`), আর ছাড়কে
    //    উপেক্ষা করলে "আয়" কাগজে বেশি দেখাত — অথচ টাকা আসেনি।
    //
    // ⚠️ `cycle` ও `couponCode` এখানে `metadata`-এ, নতুন কলাম নয় (কোনো DDL
    //    লাগে না)। `couponCode`-এর **একমাত্র** কাজ: কুপন কতবার খরচ হলো তা পরে
    //    গোনা যাবে (`countCouponRedemptions`)। আর `cycle` পড়ে grant সিদ্ধান্ত
    //    নেয় মেয়াদ ৩০ দিন হবে, নাকি ৩৬৫।
    await db.paymentTransaction.create({
      data: {
        sessionId: invoiceId,
        userId: user.userId,
        packageId: package_id,
        amount: priced.finalAmount,
        currency: paymentPackage.currency,
        gateway: "uddoktapay",
        paymentStatus: "initiated",
        status: "pending",
        metadata: {
          plan: paymentPackage.plan,
          invoice_id: invoiceId,
          local_reference: localReference,
          cycle,
          listAmount: priced.listAmount,
          discountAmount: priced.discountAmount,
          ...(coupon ? { couponCode: coupon.code, discountPercent: coupon.percentOff ?? null } : {}),
          raw_response: data,
        },
      },
    });

    return NextResponse.json({
      url: data.payment_url,
      invoice_id: invoiceId,
      // ⚠️ পর্দার জন্য ফিরিয়ে দেওয়া হয়, যাতে সফলভাবে গণনা হওয়া দামটি
      //    checkout-এ দেখানো যায় — আর দুই জায়গায় একই সংখ্যা আসে কি না
      //    সেটি চোখে মেলানো যায়।
      amount: priced.finalAmount,
      discount: priced.discountAmount,
    });
  } catch (error) {
    console.error("[UDDOKTAPAY_CHARGE]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** কুপন প্রত্যাখ্যানের কারণ → merchant-এর পড়ার মতো একটি বাক্য। */
function couponErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case "not_found":
      return "That coupon code does not exist.";
    case "inactive":
      return "That coupon code is no longer active.";
    case "expired":
      return "That coupon code has expired.";
    case "limit_reached":
      return "That coupon code has reached its usage limit.";
    case "not_applicable":
      return "That coupon code cannot be used for this purchase.";
    default:
      return "That coupon code could not be applied.";
  }
}
