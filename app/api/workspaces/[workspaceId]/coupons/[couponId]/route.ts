import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { isUniqueViolation } from "@/lib/core/prisma-errors";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import { MerchantCouponPatchSchema, MerchantCouponPayloadSchema } from "@/lib/domain/merchant-coupon";

type RouteContext = { params: Promise<{ workspaceId: string; couponId: string }> };

async function authorize(userId: string, workspaceId: string, couponId: string) {
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return { response: NextResponse.json({ error: "Business not found" }, { status: 404 }) };
  if (!access.canWrite) return { response: NextResponse.json({ error: "Offer edit access required" }, { status: 403 }) };
  const coupon = await db.merchantCoupon.findFirst({ where: { id: couponId, workspaceId } });
  if (!coupon) return { response: NextResponse.json({ error: "Offer not found" }, { status: 404 }) };
  return { access, coupon };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, couponId } = await params;
  const authorized = await authorize(user.userId, workspaceId, couponId);
  if ("response" in authorized) return authorized.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = MerchantCouponPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the offer details", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const merged = MerchantCouponPayloadSchema.safeParse({
      code: parsed.data.code ?? authorized.coupon.code,
      title: parsed.data.title !== undefined ? parsed.data.title : authorized.coupon.title,
      type: parsed.data.type ?? authorized.coupon.type,
      value: parsed.data.value ?? authorized.coupon.value,
      minOrder: parsed.data.minOrder ?? authorized.coupon.minOrder,
      startsAt: parsed.data.startsAt !== undefined ? parsed.data.startsAt : authorized.coupon.startsAt,
      expiresAt: parsed.data.expiresAt !== undefined ? parsed.data.expiresAt : authorized.coupon.expiresAt,
      active: parsed.data.active ?? authorized.coupon.active,
    });
    if (!merged.success) {
      return NextResponse.json({ error: "Check the offer details", issues: merged.error.issues }, { status: 400 });
    }
    const coupon = await db.merchantCoupon.update({
      where: { id: couponId },
      data: merged.data,
    });
    return NextResponse.json(coupon);
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "That coupon code already exists in this business" }, { status: 409 });
    console.error("[WORKSPACE_COUPONS_PATCH]", error);
    return NextResponse.json({ error: "Could not save the offer" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, couponId } = await params;
  const authorized = await authorize(user.userId, workspaceId, couponId);
  if ("response" in authorized) return authorized.response;

  try {
    await db.merchantCoupon.delete({ where: { id: couponId } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[WORKSPACE_COUPONS_DELETE]", error);
    return NextResponse.json({ error: "Could not delete the offer" }, { status: 500 });
  }
}
