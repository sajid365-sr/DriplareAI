"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompare, MessageSquare, PanelBottom, Settings2 } from "lucide-react";
import { ChatPreview } from "../_components/chat-preview";
import { SessionHistory } from "./_components/session-history";
import { useBot } from "../_providers/bot-provider";
import { useTester } from "../_providers/tester-provider";

/** টেস্টার কোথায় থাকবে — পেজ জুড়ে, নাকি কোণার বাবলে। */
type Mode = "docked" | "bubble";

/**
 * Playground — পরখ করার জায়গা, কনফিগার করার নয়।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে টেস্টার ছিল Setup পেজের ৩৬০px ডান প্যানে। অথচ পরখ করাই ছিল এই সেকশনের
 * সবচেয়ে দরকারি কাজগুলোর একটা, আর prompt-এর লম্বা লেখা পড়তে পড়তে সরু প্যানে
 * চ্যাট করা অস্বস্তিকর। এখন এটা নিজের পেজে, পুরো জায়গা নিয়ে।
 *
 * ⚠️ "Docked / Bubble" — দুইটাই এখানেই, শেলের বাবলটা `/playground`-এ ইচ্ছাকৃতভাবে
 *    বন্ধ (`layout.tsx`)। নইলে একই টেস্টার দুইবার, একই কথোপকথন দুই জায়গায়।
 */
export default function PlaygroundPage() {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");
  const { bot } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();
  const [mode, setMode] = useState<Mode>("docked");

  const preview = (onClose?: () => void) => (
    <ChatPreview
      bot={bot}
      messages={messages}
      input={input}
      sending={sending}
      onInputChange={setInput}
      onSend={sendMessage}
      onReset={reset}
      onClose={onClose}
    />
  );

  const modes: Array<{ key: Mode; icon: typeof PanelBottom; label: string }> = [
    { key: "docked", icon: PanelBottom, label: t("chat_test.mode.docked", "Docked") },
    { key: "bubble", icon: MessageSquare, label: t("chat_test.mode.bubble", "Bubble") },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {t("chat_test.playgroundTitle", "Playground")}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
            {t("chat_test.playgroundSubtitle", "Talk to your agent the way a customer would. It answers with your saved settings, on the same channels your customers use.")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/chatbots/${chatbotId}/setup`}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold border border-border text-foreground hover:bg-muted transition-all active:scale-95"
            data-testid="open-setup"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("chat_test.openSetup", "Configure in Setup")}</span>
          </Link>
          <Link
            href={`/dashboard/chatbots/${chatbotId}/playground/compare`}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-all active:scale-95"
            data-testid="open-compare"
          >
            <GitCompare className="w-4 h-4" />
            <span className="hidden sm:inline">{t("chat_test.compareModels", "Compare models")}</span>
          </Link>
        </div>
      </div>

      {/* ─── Docked / Bubble ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
          {modes.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                mode === key
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "docked"
            ? t("chat_test.mode.dockedHint", "The tester takes the whole page.")
            : t("chat_test.mode.bubbleHint", "The tester floats in the corner, so you can keep working.")}
        </p>
      </div>

      {/* ─── Docked ─────────────────────────────────────────────── */}
      {mode === "docked" && (
        // উচ্চতা `100dvh-16rem`: হেডার (৬৪px) + এই পেজের শিরোনাম, টগল আর
        // নিচের ফাঁকা জায়গা বাদ দিয়ে যা থাকে। চ্যাট অ্যাপ সরুই ভালো, তাই
        // `max-w-2xl` — ফুল-উইথ লাইনে চোখ এক জায়গা থেকে আরেক জায়গায়
        // লাফাতে হয়।
        <div className="mx-auto w-full max-w-2xl h-[calc(100dvh-16rem)] min-h-[420px]">
          {preview()}
        </div>
      )}

      {/* ─── Bubble ─────────────────────────────────────────────── */}
      {mode === "bubble" && (
        <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t("chat_test.bubbleOnly", "Your agent is running in the corner bubble. Switch to Docked to give it the full page.")}
          </p>
        </div>
      )}

      {/* ─── ইতিহাস ────────────────────────────────────────────── */}
      <SessionHistory />

      {/* বাবল মোডে টেস্টারটা সত্যিই কোণায় ভাসে — `AnimatePresence` দিয়ে,
          নইলে মোড বদলানোর সময় হঠাৎ পপ করে দেখা দিত। */}
      <AnimatePresence>
        {mode === "bubble" && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[560px] max-h-[75vh] z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-card"
          >
            {preview(() => setMode("docked"))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
