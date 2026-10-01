"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Live widget settings — which agent's widget also floats outside the Playground.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The Playground toggle is a **preference**, and a preference should survive a
 * reload. So the value lives in this small store rather than component state, and
 * the store is persisted to localStorage. It is not kept in the database on
 * purpose: this is a per-device convenience, not business data — and changing the
 * schema in this project means `prisma db push`, which has a history of dropping
 * the live n8n chat table.
 *
 * ⚠️ `floating` is a `Record<chatbotId, boolean>`, not a single boolean. A merchant
 *    can own several agents, and turning the bubble on for one of them must not
 *    float the widgets of all the others — that would stop being a preference.
 */

const STORAGE_KEY = "driplare_live_widget";

/** Agent-section route: `/dashboard/chatbots/<id>/…` (bare `/chatbots` excluded). */
const CHATBOT_PATH = /^\/dashboard\/chatbots\/([^/]+)/;

interface LiveWidgetState {
  /** chatbotId → "should this agent's widget float on the other pages too?" */
  floating: Record<string, boolean>;
  /** The last agent that was open — which bubble to show outside the agent section. */
  lastChatbotId: string | null;
  setFloating: (chatbotId: string, value: boolean) => void;
  rememberChatbot: (chatbotId: string) => void;
}

export const useLiveWidgetStore = create<LiveWidgetState>()(
  persist(
    (set) => ({
      floating: {},
      lastChatbotId: null,

      setFloating: (chatbotId, value) =>
        set((prev) => ({ floating: { ...prev.floating, [chatbotId]: value } })),

      // Writing the same id again returns **the exact same** state object. Zustand
      // then changes nothing and notifies nobody — otherwise every navigation would
      // re-render every subscriber for no reason.
      rememberChatbot: (chatbotId) =>
        set((prev) =>
          prev.lastChatbotId === chatbotId ? prev : { lastChatbotId: chatbotId }
        ),
    }),
    { name: STORAGE_KEY }
  )
);

/** `useSyncExternalStore`'s subscribe — the value never changes, so there is nothing to do. */
const noopSubscribe = () => () => {};

/**
 * Whether hydration has finished.
 *
 * The persisted value lives in localStorage, so reading it on the server is
 * **impossible**. The server render and the first client render can therefore
 * disagree — and that is exactly what a React hydration mismatch is. The third
 * argument of `useSyncExternalStore` does this job: during hydration it returns the
 * server snapshot (`false`), then moves on to the client one (`true`).
 *
 * ⚠️ The effect + `setMounted(true)` route was deliberately not taken here —
 *    `react-hooks/set-state-in-effect` is active in this repo, and that rule exists
 *    precisely to catch this kind of cascading render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Which agent is active right now — the id from the route, or the last one opened.
 *
 * ⚠️ `useParams()` cannot be used here: this hook is called from
 *    `app/(dashboard)/layout.tsx`, which sits **above** the `[chatbotId]` segment —
 *    so params can come back empty in that layout. Parsing the pathname is
 *    deterministic, and gives the same answer on the server.
 */
export function useActiveChatbotId(): string | null {
  const pathname = usePathname();
  const routeId = chatbotIdFromPath(pathname);
  const lastChatbotId = useLiveWidgetStore((s) => s.lastChatbotId);
  const rememberChatbot = useLiveWidgetStore((s) => s.rememberChatbot);
  const hydrated = useHydrated();

  useEffect(() => {
    if (routeId) rememberChatbot(routeId);
  }, [routeId, rememberChatbot]);

  // ⚠️ During hydration the route id is returned, never the persisted one. Otherwise
  //    the server would render "null" and the client "test_abc" — which is the very
  //    mismatch `useHydrated` exists to avoid.
  return routeId ?? (hydrated ? lastChatbotId : null);
}

/** The agent id out of a pathname — `null` when it does not match. */
function chatbotIdFromPath(pathname: string | null): string | null {
  return pathname?.match(CHATBOT_PATH)?.[1] ?? null;
}

/**
 * Whether the floating bubble is visible right now.
 *
 * ⚠️ The single source of truth for "whose corner is this". It had a second reader —
 *    the landing page's `FloatingBubbles` pair used it to step aside on the dashboard —
 *    but the dashboard no longer draws that pair, so `LiveWidget` is now the only one.
 *    It stays a hook rather than an inline expression because the rule it encodes
 *    (hydrated, an agent is known, the toggle is on, and this is not the widget's own
 *    page) is four conditions that nothing else should have to repeat.
 */
export function useFloatingWidgetEnabled(): boolean {
  const pathname = usePathname();
  const chatbotId = useActiveChatbotId();
  const hydrated = useHydrated();
  const floating = useLiveWidgetStore((s) =>
    chatbotId ? s.floating[chatbotId] === true : false
  );

  if (!hydrated || !chatbotId || !floating) return false;
  return !isWidgetHostPage(pathname);
}

/**
 * Where the widget must not float.
 *
 * On the Playground the widget is the page content itself, and Live Inbox is already
 * a full chat screen — a bubble there would mean the same thing twice.
 */
function isWidgetHostPage(pathname: string | null): boolean {
  return Boolean(pathname?.includes("/playground") || pathname?.includes("/inbox"));
}
