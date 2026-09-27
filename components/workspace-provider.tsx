"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type Workspace,
  getWorkspaceCookie,
  setWorkspaceCookie,
} from "@/lib/core/workspace";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  loading: boolean;
  /** Switch the active business — persists the cookie and reloads so every
   *  page + server route re-scopes to the new workspace. */
  switchWorkspace: (workspaceId: string) => void;
  /** Create a new business, refresh the list, and switch to it. */
  addWorkspace: (name: string, logoUrl?: string) => Promise<Workspace | null>;
  /** Rename a business (and optionally update its logo), then refresh the list. */
  updateWorkspace: (
    workspaceId: string,
    name: string,
    logoUrl?: string
  ) => Promise<Workspace | null>;
  /** Delete a business and all its data. Reloads scoped to the next business
   *  if the deleted one was active. */
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  activeWorkspaceId: null,
  loading: true,
  switchWorkspace: () => {},
  addWorkspace: async () => null,
  updateWorkspace: async () => null,
  deleteWorkspace: async () => false,
  refresh: async () => {},
});

interface WorkspacesResponse {
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Apply an /api/workspaces payload to state. Kept setState-only (no fetch) so
  // it can run inside a .then() callback — both on mount and on manual refresh.
  const applyData = useCallback((data: WorkspacesResponse) => {
    const list: Workspace[] = data?.workspaces || [];
    setWorkspaces(list);
    // Cookie wins (user's explicit choice); otherwise use server default.
    const cookieId = getWorkspaceCookie();
    const resolved =
      (cookieId && list.some((w) => w.workspaceId === cookieId) && cookieId) ||
      data?.activeWorkspaceId ||
      list[0]?.workspaceId ||
      null;
    setActiveWorkspaceId(resolved);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) return;
      applyData(await res.json());
    } catch (err) {
      console.error("[WorkspaceProvider] refresh failed", err);
    }
  }, [applyData]);

  useEffect(() => {
    // Inline fetch with setState inside the .then() callback (house style).
    fetch("/api/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) applyData(data);
        else setLoading(false);
      })
      .catch((err) => {
        console.error("[WorkspaceProvider] load failed", err);
        setLoading(false);
      });
  }, [applyData]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspaceId === activeWorkspaceId) return;
      setWorkspaceCookie(workspaceId);
      setActiveWorkspaceId(workspaceId);
      // Full reload guarantees all client fetches + server routes re-scope.
      window.location.reload();
    },
    [activeWorkspaceId]
  );

  const addWorkspace = useCallback(
    async (name: string, logoUrl?: string) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl }),
      });
      if (!res.ok) return null;
      const workspace: Workspace = await res.json();
      await refresh();
      return workspace;
    },
    [refresh]
  );

  const updateWorkspace = useCallback(
    async (workspaceId: string, name: string, logoUrl?: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl }),
      });
      if (!res.ok) return null;
      const workspace: Workspace = await res.json();
      await refresh();
      return workspace;
    },
    [refresh]
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) return false;
      const data: { nextWorkspaceId?: string | null } = await res
        .json()
        .catch(() => ({}));
      // If the active business was deleted, re-point the cookie and reload so
      // every fetch re-scopes to the next business.
      if (workspaceId === activeWorkspaceId && data.nextWorkspaceId) {
        setWorkspaceCookie(data.nextWorkspaceId);
        window.location.reload();
        return true;
      }
      await refresh();
      return true;
    },
    [activeWorkspaceId, refresh]
  );

  const activeWorkspace =
    workspaces.find((w) => w.workspaceId === activeWorkspaceId) ||
    workspaces[0] ||
    null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        loading,
        switchWorkspace,
        addWorkspace,
        updateWorkspace,
        deleteWorkspace,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
