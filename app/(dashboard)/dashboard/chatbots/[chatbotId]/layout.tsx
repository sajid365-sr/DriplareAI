"use client";

import type { ReactNode } from "react";
import { BotProvider } from "./_providers/bot-provider";

/**
 * The agent section's data shell.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This sits here because of a Next.js App Router behaviour: **a layout lives on the
 * parent segment, so it does not unmount when you move between sibling routes** —
 * only the `page` changes. Every agent tab (Setup, Playground, Analytics, Settings)
 * is a child of the same `[chatbotId]` segment, so switching tabs now swaps only the
 * content inside, nothing outside it.
 *
 * Each page used to run its own `GET /api/chatbots/[id]` and show a loading screen
 * every single time — while only the tab was changing and the data was identical. The
 * fetch happens once here now, and the data survives a tab switch.
 *
 * ⚠️ **One provider only** here — `BotProvider` (what the agent is: name, model,
 *    prompt, and whether it has been saved). The tester's conversation
 *    (`TesterProvider`) has moved out of here into `app/(dashboard)/layout.tsx`,
 *    because the widget no longer stays inside the agent section: with the toggle on
 *    it floats across every dashboard page, and the conversation has to be **the
 *    same** out there. With both providers here, typing one character of the prompt
 *    would re-render the chat list — hence the split, and hence two levels.
 */
export default function ChatbotLayout({ children }: { children: ReactNode }) {
  return <BotProvider>{children}</BotProvider>;
}
