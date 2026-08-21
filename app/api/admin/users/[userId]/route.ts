import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { adminUserUpdateSchema } from "@/lib/domain/admin-schemas";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { userId: targetUserId } = await context.params;
    const body = await req.json();
    const parsed = adminUserUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { role, ...rest } = parsed.data;

    // Only super_admin can assign admin roles
    if (role !== undefined) {
      if (authResult.role !== "super_admin") {
        return NextResponse.json(
          { error: "Only super_admin can change user roles" },
          { status: 403 }
        );
      }

      if (targetUserId === authResult.userId && role === "user") {
        return NextResponse.json(
          { error: "Cannot demote your own admin access" },
          { status: 400 }
        );
      }
    }

    const updated = await db.user.update({
      where: { userId: targetUserId },
      data: {
        ...rest,
        ...(role !== undefined ? { role } : {}),
      },
      select: {
        userId: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        region: true,
        creditsBalance: true,
        includedCredits: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("[ADMIN_USER_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { userId: targetUserId } = await context.params;

    const user = await db.user.findUnique({
      where: { userId: targetUserId },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        picture: true,
        plan: true,
        role: true,
        region: true,
        creditsBalance: true,
        includedCredits: true,
        creditsUsedThisCycle: true,
        planExpiresAt: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chatbots: true,
            workspaces: true,
            payments: true,
            referralsMade: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[ADMIN_USER_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
