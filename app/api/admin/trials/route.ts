import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { buildTrialReport } from "@/lib/domain/trial";

/**
 * GET /api/admin/trials — read-only trial রিপোর্ট (১৫.৬)
 *
 * কেন দরকার: trial-এর abuse-তালা এই round-এ **ইচ্ছাকৃতভাবে কেবল** Clerk-এর
 * verified email। IP বা ফোন সংরক্ষিতই নেই (কোনো কলাম নেই), আর সেটি ধরতে নতুন
 * কলাম মানে DDL — যা এই round-এ নেই। তাই যন্ত্রে ধরা না-পড়া জিনিসটি admin-এর
 * চোখে পড়ার ব্যবস্থা রাখা হলো: একই corporate domain থেকে একাধিক trial।
 *
 * ⚠️ **নীতিগতভাবে read-only।** কোনো trial বাতিল/পরিণত করার action এখানে নেই,
 *    কারণ দুটোরই আসল পথ অন্য জায়গায়: টাকা `applyPaymentGrant`-এ, আর plan
 *    admin-এর `setUserPlan`-এ। এখানে দ্বিতীয় পথ বানালে সেটি তৃতীয় কপি হত।
 */
export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const report = await buildTrialReport();

    return NextResponse.json(report);
  } catch (error) {
    console.error("[ADMIN_TRIALS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
