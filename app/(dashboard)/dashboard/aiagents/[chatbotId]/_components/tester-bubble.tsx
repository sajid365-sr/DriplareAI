"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sparkles, X } from "lucide-react";
import { ChatPreview } from "./chat-preview";
import { useBot } from "../_providers/bot-provider";
import { useTester } from "../_providers/tester-provider";

/**
 * কোণায় ভাসা টেস্টার — এজেন্ট-সেকশনের সব পেজে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * এটা `[chatbotId]/layout.tsx`-এ বসে, কোনো পেজে নয়। কারণ কথোপকথনটা
 * `TesterProvider`-এ থাকে, অর্থাৎ শেলেরই জিনিস; তাই Analytics-এ একটা প্রশ্ন
 * করে Setup-এ ফিরে এলেও উত্তরটা ওখানেই থাকে — আর বাবলটা বন্ধ করে Playground-এ
 * গেলে নতুন সেশন শুরু হয় না।
 *
 * আগে এটা Setup পেজের ভেতরে ছিল, আর কেবল `xl`-এর নিচে (ওখানে ডান প্যানটা
 * দায়িত্ব নিত)। এখন Setup-এ কোনো প্যান নেই, তাই বাবলটাই সব সাইজে একমাত্র
 * প্রবেশপথ — `xl:hidden`-ও তাই চলে গেছে।
 */
export function TesterBubble() {
  const { t } = useTranslation("chatbots");
  const { bot } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
        {/* Teaser badge — শুধু বন্ধ থাকলে, আর নতুন ব্যবহারকারীর চোখে পড়ার জন্য */}
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={() => setOpen(true)}
            className="bg-card border border-primary/30 text-foreground shadow-lg px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer select-none"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>{t("chat_test.widget.teaser", "⚡ Test me!")}</span>
          </motion.button>
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="w-14 h-14 rounded-full bg-brand-gradient text-white shadow-2xl shadow-primary/40 flex items-center justify-center border-2 border-white/20 ring-4 ring-primary/10 cursor-pointer"
          title={
            open
              ? t("chat_test.widget.close", "Close Live Chat Simulator")
              : t("chat_test.widget.open", "Open Live Chat Simulator")
          }
        >
          {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[580px] max-h-[80vh] z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-card"
          >
            <ChatPreview
              bot={bot}
              messages={messages}
              input={input}
              sending={sending}
              onInputChange={setInput}
              onSend={sendMessage}
              onReset={reset}
              onClose={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
