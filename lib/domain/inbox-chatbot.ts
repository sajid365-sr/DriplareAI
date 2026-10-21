/**
 * Which agent the global Live Inbox should display.
 *
 * ── Why this is its own module ───────────────────────────────────────────────
 * The inbox has no `[chatbotId]` in its URL, so the agent has to be chosen from
 * the list the header already knows about. That choice has one non-obvious rule
 * (see `pickInboxChatbot`), and it is the kind of rule that silently regresses:
 * the previous version simply took `bots[0]`, and because `/api/chatbots` sorts
 * newest-first, a newly created test agent with zero conversations made a
 * workspace full of live chats look empty. The user concluded their messages had
 * disappeared. Keeping the rule pure here lets a test defend it.
 *
 * Pure by design: no React, no `fetch`, no `server-only`.
 */

/** Only the fields this rule reads; anything richer is passed through. */
export interface InboxChatbotCandidate {
  /** `Chatbot.id` — the route id used by `/api/chatbots/{id}/sessions`. */
  id: string;
  /** `Chatbot.chatbotId` — the public id agents are addressed by elsewhere. */
  chatbotId: string;
  _count?: { sessions?: number };
}

/**
 * Choose the agent for the inbox.
 *
 * 1. An explicit active id wins — either the row id or the public `chatbotId`,
 *    because both address the same agent.
 * 2. Otherwise pick the agent with the **most sessions**. The inbox exists to
 *    show conversations; when the URL names no agent, the one with the most
 *    conversations is the best guess. Ties keep the earlier entry, and callers
 *    pass the API list newest-first — so a brand-new empty agent only wins when
 *    no agent has any sessions at all.
 * 3. An empty list has no answer (`null`), not `undefined`.
 */
export function pickInboxChatbot<T extends InboxChatbotCandidate>(
  bots: T[],
  activeId: string | null
): T | null {
  if (bots.length === 0) return null;

  if (activeId) {
    const explicit =
      bots.find((bot) => bot.id === activeId) ??
      bots.find((bot) => bot.chatbotId === activeId);
    if (explicit) return explicit;
  }

  // `reduce` keeps the first maximum, which preserves the newest-first order.
  return bots.reduce((best, bot) =>
    (bot._count?.sessions ?? 0) > (best._count?.sessions ?? 0) ? bot : best
  );
}
