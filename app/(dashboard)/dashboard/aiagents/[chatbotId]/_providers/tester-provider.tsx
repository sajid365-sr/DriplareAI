"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ChatAttachment, ChatMessage } from "../_components/chat-bubble";

/**
 * The tester's conversation — bot-provider's sibling, but separate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a separate provider: bot data (name, model, prompt) and the conversation do
 * not share a lifetime. Switching bots should discard the conversation, but editing
 * one character of the prompt should not. Kept together, every keystroke would give
 * `messages` a new context value too, re-rendering the chat list on each one.
 *
 * ⚠️ This provider now sits in `app/(dashboard)/layout.tsx`, not in
 *    `[chatbotId]/layout.tsx`. The widget no longer lives only inside the agent
 *    section — with the toggle on it floats across the whole dashboard, and it has to
 *    show the **same** conversation out there. Lifting the provider up means asking a
 *    question on Analytics and opening the bubble on Products still shows the answer.
 *
 * ⚠️ There is no `useParams()` here — the id arrives as a prop (`useActiveChatbotId`).
 *    The layout above it can see empty params; the details are in that hook's file.
 */

/** A finished conversation — resetting files the previous one here. */
export interface TesterSession {
  /** The id sent to the bot. The history sits under this id in server memory (n8n). */
  id: string;
  messages: ChatMessage[];
  /** When it started — the only way to tell them apart in the list. */
  startedAt: string;
}

/** How many past sessions to keep. Older ones fall off the end. */
const MAX_PAST_SESSIONS = 10;

/**
 * One conversation, **tagged with the id of its agent**.
 *
 * Because `botId` is part of the state, switching agents needs no effect to clear
 * the old messages — the read itself checks whether they belong to this agent.
 * (That is how this avoids the cascading render `react-hooks/set-state-in-effect`
 * is there to catch.)
 */
interface TesterConversation {
  botId: string | null;
  messages: ChatMessage[];
  sessionId: string | null;
  past: TesterSession[];
}

const EMPTY_CONVERSATION: TesterConversation = {
  botId: null,
  messages: [],
  sessionId: null,
  past: [],
};

interface TesterContextValue {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  /** If no `customMessage` is given, whatever is in the input box is sent (chips pass one). */
  sendMessage: (customMessage?: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** Start a new conversation — the current one is archived, not deleted. */
  reset: () => void;
  /** The id sent to the bot — this is what holds the conversation's memory. */
  sessionId: string | null;
  pastSessions: TesterSession[];
  /** Return to an older conversation — server memory comes back under the same id. */
  restoreSession: (id: string) => void;
  clearHistory: () => void;
}

/** Calling `useTester()` outside the provider gives a harmless default instead of throwing. */
const TesterContext = createContext<TesterContextValue>({
  messages: [],
  input: "",
  setInput: () => {},
  sending: false,
  sendMessage: async () => {},
  reset: () => {},
  sessionId: null,
  pastSessions: [],
  restoreSession: () => {},
  clearHistory: () => {},
});

export function useTester() {
  return useContext(TesterContext);
}

function stamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function newSessionId() {
  return `test_${Math.random().toString(36).slice(2, 11)}`;
}

export function TesterProvider({
  chatbotId,
  children,
}: {
  chatbotId: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation("chatbots");

  const [convo, setConvo] = useState<TesterConversation>(EMPTY_CONVERSATION);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Whether this conversation belongs to this agent. When it does not, empty values
  // are shown — nothing has to be cleared, it is simply not read. Come back to the
  // agent and the messages are still there.
  const owns = convo.botId === chatbotId;
  const messages = owns ? convo.messages : EMPTY_CONVERSATION.messages;
  const pastSessions = owns ? convo.past : EMPTY_CONVERSATION.past;
  const sessionId = owns ? convo.sessionId : null;

  const sendMessage = useCallback(
    async (customMessage?: string, attachments?: ChatAttachment[]) => {
      const text = customMessage !== undefined ? customMessage : input;
      if ((!text.trim() && (!attachments || attachments.length === 0)) || sending) return;
      if (!chatbotId) return;

      // The session id is created here and used immediately — waiting for `state` to
      // be set would send the very first question into a session with no memory.
      const activeSession = sessionId ?? newSessionId();

      setInput("");
      setConvo((prev) => {
        const base = prev.botId === chatbotId ? prev : { ...EMPTY_CONVERSATION, botId: chatbotId };
        return {
          ...base,
          sessionId: base.sessionId ?? activeSession,
          messages: [
            ...base.messages,
            { role: "user", content: text, timestamp: stamp(), attachments },
          ],
        };
      });
      setSending(true);

      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId: activeSession, attachments }),
        });
        const data = await res.json();
        if (res.ok) {
          // If the agent changed while the reply was in flight, this answer is not the
          // current agent's — it is dropped.
          setConvo((prev) =>
            prev.botId !== chatbotId
              ? prev
              : {
                  ...prev,
                  messages: [
                    ...prev.messages,
                    { role: "assistant", content: data.reply, timestamp: stamp() },
                  ],
                }
          );
        } else {
          toast.error(data.error || t("chat_test.toast.replyFailed", "Failed to get response"));
        }
      } catch {
        toast.error(t("chat_test.toast.connectionError", "Connection error"));
      } finally {
        setSending(false);
      }
    },
    [chatbotId, input, sending, sessionId, t]
  );

  /**
   * Files the current conversation into history (if there is one), then clears the screen.
   *
   * Without the archiving, "Clear chat" would mean "delete forever" — when all the
   * user wanted was a fresh start, not to lose three good answers.
   */
  const reset = useCallback(() => {
    setConvo((prev) => {
      if (prev.botId !== chatbotId) return prev;
      if (prev.messages.length === 0) return { ...prev, sessionId: null };
      return {
        ...EMPTY_CONVERSATION,
        botId: chatbotId,
        past: [archive(prev), ...prev.past].slice(0, MAX_PAST_SESSIONS),
      };
    });
  }, [chatbotId]);

  const restoreSession = useCallback(
    (id: string) => {
      setConvo((prev) => {
        if (prev.botId !== chatbotId) return prev;
        const target = prev.past.find((s) => s.id === id);
        if (!target) return prev;

        const rest = prev.past.filter((s) => s.id !== id);
        return {
          botId: prev.botId,
          messages: target.messages,
          // The id is handed back rather than regenerated: the conversation is still
          // sitting under this id in server memory (n8n chat memory), so the bot keeps
          // its thread of the story too.
          sessionId: target.id,
          past: (prev.messages.length > 0 ? [archive(prev), ...rest] : rest).slice(
            0,
            MAX_PAST_SESSIONS
          ),
        };
      });
    },
    [chatbotId]
  );

  const clearHistory = useCallback(() => {
    setConvo((prev) => (prev.botId === chatbotId ? { ...prev, past: [] } : prev));
  }, [chatbotId]);

  const value = useMemo<TesterContextValue>(
    () => ({
      messages,
      input,
      setInput,
      sending,
      sendMessage,
      reset,
      sessionId,
      pastSessions,
      restoreSession,
      clearHistory,
    }),
    [messages, input, sending, sendMessage, reset, sessionId, pastSessions, restoreSession, clearHistory]
  );

  return <TesterContext.Provider value={value}>{children}</TesterContext.Provider>;
}

/** Turns the current conversation into a history entry. */
function archive(convo: TesterConversation): TesterSession {
  return {
    id: convo.sessionId ?? newSessionId(),
    messages: convo.messages,
    startedAt: convo.messages[0]?.timestamp ?? stamp(),
  };
}
