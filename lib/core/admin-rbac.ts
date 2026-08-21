/** Roles that grant access to the platform admin portal */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

type ClerkPublicMetadata = {
  role?: string;
};

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "admin" || role === "super_admin";
}

/**
 * Edge-safe Clerk metadata check for proxy/middleware.
 */
export function isClerkAdminFromClaims(
  sessionClaims: Record<string, unknown> | null | undefined
): boolean {
  if (!sessionClaims) return false;

  const publicMeta = sessionClaims.publicMetadata as ClerkPublicMetadata | undefined;
  const legacyMeta = sessionClaims.metadata as ClerkPublicMetadata | undefined;

  return isAdminRole(publicMeta?.role) || isAdminRole(legacyMeta?.role);
}

export function getExplicitClerkRole(
  sessionClaims: Record<string, unknown> | null | undefined
): string | undefined {
  if (!sessionClaims) return undefined;
  const publicMeta = sessionClaims.publicMetadata as ClerkPublicMetadata | undefined;
  const legacyMeta = sessionClaims.metadata as ClerkPublicMetadata | undefined;
  return publicMeta?.role ?? legacyMeta?.role;
}
