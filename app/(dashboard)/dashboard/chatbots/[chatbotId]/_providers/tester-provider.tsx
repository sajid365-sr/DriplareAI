"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ChatAttachment, ChatMessage } from "../_components/chat-bubble";

/**
 * টেস্টারের কথোপকথন — bot-provider-এর ভাই, কিন্তু আলাদা।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * কেন আলাদা provider: bot ডেটা (নাম, মডেল, prompt) আর কথোপকথন — এই দুটোর
 * জীবনকাল এক নয়। bot বদলালে কথোপকথন ফেলে দেওয়া উচিত, কিন্তু prompt-এর একটা
 * অক্ষর বদলালে নয়। একসাথে রাখলে প্রতিটা keystroke-এ `messages`-ও নতুন context
 * value পেত, অর্থাৎ চ্যাট লিস্ট প্রতিবার re-render হত।
 *
 * ⚠️ সেশন-আইডি এখানে, পেজে নয়। টেস্টার দুই জায়গায় আঁকা হয় (Setup-এর ফ্লোটিং
 *    বাবল আর Playground-এর পেজ), অথচ কথোপকথন একটাই।
 */

/** শেষ হওয়া একটা কথোপকথন — রিসেট করলে আগেরটা এখানে জমা হয়। */
export interface TesterSession {
  /** বটকে পাঠানো আইডি। সার্ভারে (n8n chat memory) এই আইডিতেই ইতিহাসটা পড়ে আছে। */
  id: string;
  messages: ChatMessage[];
  /** কখন শুরু হয়েছিল — তালিকায় চেনার একমাত্র উপায়। */
  startedAt: string;
}

/** সর্বোচ্চ কতগুলো পুরনো সেশন রাখা হবে। এর বেশি হলে পুরনোটা ঝরে যায়। */
const MAX_PAST_SESSIONS = 10;

interface TesterContextValue {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  /** `customMessage` না দিলে ইনপুট বক্সের লেখাটাই যায় (চিপ থেকে ডাকলে দেয়)। */
  sendMessage: (customMessage?: string, attachments?: ChatAttachment[]) => Promise<void>;
  /** নতুন কথোপকথন শুরু — চলতি কথাটা ইতিহাসে জমা হয়, মুছে যায় না। */
  reset: () => void;
  /** বটকে পাঠানো আইডি — এটাই কথোপকথনের মেমোরি ধরে রাখে। */
  sessionId: string | null;
  pastSessions: TesterSession[];
  /** পুরনো কথোপকথনে ফেরা — সার্ভারের মেমোরিও একই আইডিতেই ফিরে আসে। */
  restoreSession: (id: string) => void;
  clearHistory: () => void;
}

/** Provider-এর বাইরে `useTester()` ডাকলে ভাঙার বদলে নিরীহ ডিফল্ট। */
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

export function TesterProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const chatbotId = params?.chatbotId as string | undefined;
  const { t } = useTranslation("chatbots");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<TesterSession[]>([]);

  const sendMessage = useCallback(
    async (customMessage?: string, attachments?: ChatAttachment[]) => {
      const text = customMessage !== undefined ? customMessage : input;
      if ((!text.trim() && (!attachments || attachments.length === 0)) || sending) return;
      if (!chatbotId) return;

      // সেশন-আইডি এখানেই বানানো হয়, তারপর সাথে সাথেই ব্যবহার — `state` সেট হওয়ার
      // জন্য অপেক্ষা করলে প্রথম প্রশ্নটাই মেমোরিহীন সেশনে যেত।
      const activeSession = sessionId ?? `test_${Math.random().toString(36).slice(2, 11)}`;
      if (!sessionId) setSessionId(activeSession);

      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, timestamp: stamp(), attachments },
      ]);
      setSending(true);

      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId: activeSession, attachments }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply, timestamp: stamp() },
          ]);
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
   * চলতি কথোপকথনটা ইতিহাসে তুলে রাখে (থাকলে), তারপর স্ক্রিন পরিষ্কার করে।
   *
   * জমা না রাখলে "Clear chat" মানে হত চিরতরে মুছে ফেলা — অথচ ব্যবহারকারী কেবল
   * নতুন করে শুরু করতে চেয়েছিলেন, তিনটে ভালো উত্তর হারাতে নয়।
   */
  const archiveCurrent = useCallback(
    (current: ChatMessage[], currentId: string | null) => {
      if (current.length === 0) return;
      setPastSessions((prev) =>
        [
          {
            id: currentId ?? `test_${Math.random().toString(36).slice(2, 11)}`,
            messages: current,
            startedAt: current[0]?.timestamp ?? stamp(),
          },
          ...prev,
        ].slice(0, MAX_PAST_SESSIONS)
      );
    },
    []
  );

  const reset = useCallback(() => {
    archiveCurrent(messages, sessionId);
    setMessages([]);
    setSessionId(null);
  }, [archiveCurrent, messages, sessionId]);

  const restoreSession = useCallback(
    (id: string) => {
      const target = pastSessions.find((s) => s.id === id);
      if (!target) return;
      archiveCurrent(messages, sessionId);
      setPastSessions((prev) => prev.filter((s) => s.id !== id));
      setMessages(target.messages);
      // আইডিটা ফিরিয়ে দেওয়া হয়, নতুন বানানো হয় না: সার্ভারে (n8n chat memory)
      // ওই কথোপকথনটা এখনো এই আইডিতেই পড়ে আছে, তাই বটও তার ধারাবাহিকতা রাখে।
      setSessionId(target.id);
    },
    [archiveCurrent, messages, pastSessions, sessionId]
  );

  const clearHistory = useCallback(() => setPastSessions([]), []);

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
