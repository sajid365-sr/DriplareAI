/**
 * Multi-Business / Multi-Workspace — client-safe helpers.
 *
 * A Workspace represents one business. The active workspace is persisted in a
 * cookie so BOTH the client (this file) and the server (workspace-server.ts,
 * which reads it via next/headers) can resolve it. Keep this file free of any
 * server-only imports so it can be used inside client components.
 */

export const WORKSPACE_COOKIE = "driplare_workspace";

export interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Read the active workspace id from the document cookie (client-side). */
export function getWorkspaceCookie(): string | null {
  if (typeof document === "undefined") return null; // SSR fallback
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${WORKSPACE_COOKIE}=([^;]*)`)
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Persist the active workspace id in a cookie (client-side, 1 year). */
export function setWorkspaceCookie(workspaceId: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${WORKSPACE_COOKIE}=${encodeURIComponent(
    workspaceId
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}
