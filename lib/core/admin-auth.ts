import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { isAdminRole, type AdminRole } from "@/lib/core/admin-rbac";

type AdminContext = {
  userId: string;
  role: AdminRole;
  user: NonNullable<Awaited<ReturnType<typeof getAndSyncUser>>>;
};

export { ADMIN_ROLES, isAdminRole, type AdminRole } from "@/lib/core/admin-rbac";

type ClerkPublicMetadata = {
  role?: string;
};

/**
 * Resolve admin role from Clerk publicMetadata first, then Prisma User.role.
 */
export async function getAdminRole(): Promise<AdminRole | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const clerkRole = (clerkUser?.publicMetadata as ClerkPublicMetadata)?.role;
  if (isAdminRole(clerkRole)) return clerkRole;

  const dbUser = await db.user.findUnique({
    where: { userId },
    select: { role: true },
  });

  if (isAdminRole(dbUser?.role)) return dbUser.role as AdminRole;

  return null;
}

/**
 * Server-side guard for admin pages and API routes.
 * Redirects unauthenticated users to sign-in and non-admins to the merchant dashboard.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/admin");

  const role = await getAdminRole();
  if (!role) redirect("/dashboard/overview?error=admin_unauthorized");

  const user = await getAndSyncUser();
  if (!user) redirect("/sign-in?redirect_url=/admin");

  return { userId, role, user };
}

/**
 * API-safe admin guard — returns JSON error responses instead of redirects.
 */
export async function requireAdminApi(): Promise<AdminContext | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getAdminRole();
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getAndSyncUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId, role, user };
}
