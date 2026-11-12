import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { isUniqueViolation } from "@/lib/core/prisma-errors";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import { MerchantCouponPayloadSchema } from "@/lib/domain/merchant-coupon";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!access.canRead) return NextResponse.json({ error: "Business access denied" }, { status: 403 });

  try {
    const coupons = await db.merchantCoupon.findMany({
      where: { workspaceId },
      orderBy: [{ active: "desc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(coupons, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_COUPONS_GET]", error);
    return NextResponse.json({ error: "Could not load offers" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Offer edit access required" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = MerchantCouponPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the offer details", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const coupon = await db.merchantCoupon.create({
      data: { workspaceId, ...parsed.data },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "That coupon code already exists in this business" }, { status: 409 });
    console.error("[WORKSPACE_COUPONS_POST]", error);
    return NextResponse.json({ error: "Could not save the offer" }, { status: 500 });
  }
}
