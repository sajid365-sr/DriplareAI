"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ChatAttachment, ChatMessage } from "../playground/_components/chat-bubble";

/**
 * টেস্টারের কথোপকথন — bot-provider-এর ভাই, কিন্তু আলাদা।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * কেন আলাদা provider: bot ডেটা (নাম, মডেল, prompt) আর কথোপকথন — এই দুটোর
 * জীবনকাল এক নয়। bot বদলালে কথোপকথন ফেলে দেওয়া উচিত, কিন্তু prompt-এর একটা
 * অক্ষর বদলালে নয়। একসাথে রাখলে প্রতিটা keystroke-এ `messages`-ও নতুন context
 * value পেত, অর্থাৎ চ্যাট লিস্ট প্রতিবার re-render হত।
 *
 * ⚠️ সেশন-আইডি এখানে, পেজে নয়। Setup-এর ফ্লোটিং বাবল আর Playground-এর পেজ —
 *    টেস্টার দুই জায়গায় আঁকা হবে, অথচ কথোপকথন একটাই। আইডি পেজে থাকলে বাবল
 *    বন্ধ করে Playground-এ গেলে নতুন সেশন শুরু হত, আর বট তার মেমোরি হারাত।
 */

interface TesterContextValue {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  /** `customMessage` না দিলে ইনপুট বক্সের লেখাটাই যায় (চিপ থেকে ডাকলে দেয়)। */
  sendMessage: (customMessage?: string, attachments?: ChatAttachment[]) => Promise<void>;
  reset: () => void;
  /** বটকে পাঠানো আইডি — এটাই কথোপকথনের মেমোরি ধরে রাখে। */
  sessionId: string | null;
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
});

export function useTester() {
  return useContext(TesterContext);
}

export function TesterProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const chatbotId = params?.chatbotId as string | undefined;
  const { t } = useTranslation("chatbots");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

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
        {
          role: "user",
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          attachments,
        },
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
            {
              role: "assistant",
              content: data.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
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

  // সেশন-আইডিও মুছে যায় — অর্থাৎ রিসেট মানে শুধু স্ক্রিন পরিষ্কার নয়, বটের
  // মেমোরিও নতুন। নইলে "Clear chat" চেপে আবার একই প্রশ্ন করলে বট আগের
  // কথোপকথন মনে রেখে উত্তর দিত, আর ব্যবহারকারী ভাবতেন রিসেট কাজ করছে না।
  const reset = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  const value = useMemo<TesterContextValue>(
    () => ({ messages, input, setInput, sending, sendMessage, reset, sessionId }),
    [messages, input, sending, sendMessage, reset, sessionId]
  );

  return <TesterContext.Provider value={value}>{children}</TesterContext.Provider>;
}
