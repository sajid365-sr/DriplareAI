"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, MessageSquare, Sparkles, X, GitCompare, Info, Check } from "lucide-react";
import { ChatSettings } from "./_components/chat-settings";
import { ChatPreview } from "./_components/chat-preview";
import { SetupChecklist } from "./_components/setup-checklist";
import { useBot } from "../_providers/bot-provider";
import { useTester } from "../_providers/tester-provider";

/**
 * এজেন্টের Setup পেজ — কনফিগারেশন, আর পাশে লাইভ টেস্টার।
 *
 * এই পেজে আর কোনো state বা fetch নেই: `bot`/`saveSettings`/`isDirty` আসে
 * `BotProvider` থেকে, আর কথোপকথন `TesterProvider` থেকে — দুটোই
 * `[chatbotId]/layout.tsx`-এ বসানো। ফলে ট্যাব বদলে ফিরে এলে ডেটাও ফেচও আবার
 * হয় না, আর সেভ-না-করা পরিবর্তনও অটুট থাকে (আগে প্রতি ভিজিটে নতুন করে
 * লোড হয়ে সেগুলো হারিয়ে যেত)।
 */
export default function ChatPage() {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");

  const { bot, loading, saving, isDirty, userPlan, saveSettings, patchBot, selectModel } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();

  // ফ্লোটিং টেস্টার উইজেট — শুধু `xl`-এর নিচে, ওখান থেকে ডান প্যানটা দায়িত্ব নেয়।
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("chat_test.loading", "Loading...")}</div>;
  if (!bot) return <div className="p-8 text-center text-destructive">{t("chat_test.not_found", "Bot not found")}</div>;

  // টেস্টারটা দুই জায়গায় আঁকা হয় (ডান প্যান আর ফ্লোটিং উইজেট), তাই props
  // একবারই লেখা। দুবার লিখলে এক জায়গায় নতুন prop যোগ করলে অন্যটা পিছিয়ে
  // পড়ত, আর "একই" প্রিভিউ দুটো ধীরে ধীরে আলাদা হয়ে যেত।
  // `onClose` শুধু উইজেটে যায় — প্যানে বন্ধ করার কিছু নেই, তাই ওখানে X বাটনটা
  // (ChatPreview নিজেই `onClose` না পেলে আঁকে না) অনুপস্থিত থাকে।
  const renderPreview = (onClose?: () => void) => (
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

  return (
    <div className="space-y-6 pb-12 relative">
      {/* ─── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {t("chat_test.title", "Chat Playground")}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            {t("chat_test.subtitle", "Tune the settings and try the result live in the panel beside them.")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Compare-এর একমাত্র প্রবেশপথ। পেজটা এখন Playground-এর ভেতরে
              (`/playground/compare`), তাই পুরনো সাইডবার আইটেমটা চলে গেছে —
              আর লিংকহীন পেজ মানে লুকোনো পেজ (যে ভুলে `edit` আর `e-commerce`
              মরেছিল)। দুই-প্যানেল পুনর্বিন্যাসের পরও এটা হেডারেই থাকে: ডান
              প্যান এখন টেস্টার দখল করে নিয়েছে, আর Compare আলাদা পেজ। */}
          <Link
            href={`/dashboard/chatbots/${chatbotId}/playground/compare`}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-all active:scale-95"
            data-testid="open-compare"
          >
            <GitCompare className="w-4 h-4" />
            <span className="hidden sm:inline">{t("chat_test.compareModels", "Compare models")}</span>
          </Link>
          {/* dirty-aware: কিছু না বদলালে বাটনটা নিষ্ক্রিয় আর চুপচাপ — কারণ
              চাপলে কিছুই হতো না, অথচ "Save Changes" লেখাটা প্রতিবার চোখে
              পড়ে ব্যবহারকারীকে ভাবাত কতগুলো পরিবর্তন ঝুলে আছে। পরিবর্তন
              থাকলে গ্রেডিয়েন্ট ফিরে আসে, অর্থাৎ রঙটাই সংকেত। */}
          <button
            onClick={saveSettings}
            disabled={saving || !isDirty}
            data-testid="save-settings"
            className={`shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold transition-all ${isDirty
              ? "text-white bg-brand-gradient shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 cursor-pointer"
              : "bg-muted text-muted-foreground cursor-default"
              }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isDirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            {isDirty
              ? t("chat_test.config.save", "Save Changes")
              : t("chat_test.config.saved", "Saved")}
          </button>
        </div>
      </div>

      {/* ─── সেভ-করা সেটিংসের নোটিস ──────────────────────────────────
          `/api/chatbots/[id]/chat` মডেল, temperature, prompt — সব ডেটাবেস
          থেকে পড়ে; ব্রাউজারে ঝুলে থাকা (unsaved) state বলে কিছু নেই। তাই
          কিছু বদলে সেভ না করলে টেস্টারে পুরনো আচরণই ফিরে আসে, আর
          ব্যবহারকারী ভাবেন বদলটা কাজই করছে না। নোটিসটা তাই পরিবর্তন
          থাকলে জোরালো রঙ নেয় — ঠিক যখন এর দরকার। */}
      <div
        data-testid="saved-settings-notice"
        className={`flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs ${isDirty
          ? "border-warning/40 bg-warning/10 text-foreground"
          : "border-border bg-muted/40 text-muted-foreground"
          }`}
      >
        <Info className={`w-4 h-4 shrink-0 mt-px ${isDirty ? "text-warning" : ""}`} />
        <span className="leading-relaxed">
          {isDirty
            ? t("chat_test.noticeUnsaved", "You have unsaved changes. The tester always runs the saved settings, so save first to try them.")
            : t("chat_test.noticeSaved", "The tester runs your saved settings — what you try here is what your customers get.")}
        </span>
      </div>

      {/* ─── দুই প্যান (xl ও তার উপরে) ────────────────────────────────
          বাঁয়ে কনফিগারেশন, ডানে লাইভ টেস্টার — বদলটা পেজ ছেড়ে না গিয়েই
          পরখ করা যায়। `xl`-এর নিচে ডান প্যানটা `hidden`, আর টেস্টার তখন
          আগের ফ্লোটিং উইজেটেই (`xl:hidden`)। একই কম্পোনেন্ট, দুই উপস্থাপনা,
          যেমন `Sidebar`/ড্রয়ার।

          `minmax(0,1fr)` না দিলে বাঁ দিকের লম্বা কনটেন্ট (মডেলের তালিকা)
          গ্রিড ট্র্যাকটা ফুলিয়ে দিত আর ডান প্যান চেপে যেত — গ্রিড আইটেমের
          ডিফল্ট `min-width: auto`-ই এর কারণ।
          ব্রেকপয়েন্ট `xl`, কারণ এজেন্ট-পেজে দুই সাইডবার মিলে ৪৪৮px নিয়ে
          নেয়; ১২৮০px-এ বাঁ পাশে ~৪৫০px থাকে, যা সেটিংস কার্ডের জন্য
          সঙ্কুচিত হলেও চলে, আর `2xl`-এ জায়গা ফিরে পায়। */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="min-w-0 space-y-6">
          {/* ─── Setup checklist ───────────────────────────────────── */}
          {/* Every surface that trains or connects the agent lives elsewhere, so
              this is what tells the merchant where. It reads real counts and
              removes itself once there is nothing left to do. */}
          <SetupChecklist
            chatbotId={String(chatbotId)}
            knowledgeCount={
              (bot._count?.sources ?? 0) +
              (bot._count?.faqs ?? 0) +
              (bot._count?.sampleReplies ?? 0)
            }
          />

          <ChatSettings
            bot={bot}
            userPlan={userPlan}
            onBotChange={patchBot}
            onModelSelect={selectModel}
          />
        </div>

        {/* ডান প্যান। `sticky` এখানে কাজ করে কারণ গ্রিডে `xl:items-start` —
            না দিলে দুই কলাম সমান উচ্চতার হতো আর sticky-র কিছুই করার থাকত না।
            উচ্চতা `100dvh-9rem`: `main`-এর দৃশ্যমান অংশ ≈ `100dvh-64px`,
            অর্থাৎ নিচে একটু ফাঁকা থাকে, প্যানটা হেডারের গায়ে লাগে না। */}
        <aside
          data-testid="preview-pane"
          className="hidden xl:flex xl:sticky xl:top-0 h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
        >
          {renderPreview()}
        </aside>
      </div>

      {/* ─── Floating Chat Simulator Launcher & Overlay (Pinned Bottom-Right) ─── */}
      {/* শুধু `xl`-এর নিচে — ওখান থেকেই ডান প্যানটা দায়িত্ব নেয়। */}
      <div className="xl:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* Floating Tooltip Badge above Launcher (Only when widget is closed) */}
        {!isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={() => setIsWidgetOpen(true)}
            className="bg-card border border-primary/30 text-foreground shadow-lg px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce cursor-pointer select-none"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>{t("chat_test.widget.teaser", "⚡ Test me!")}</span>
          </motion.div>
        )}

        {/* Floating Launcher Trigger Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsWidgetOpen((prev) => !prev)}
          className="w-14 h-14 rounded-full bg-brand-gradient text-white shadow-2xl shadow-primary/40 flex items-center justify-center relative group cursor-pointer border-2 border-white/20 ring-4 ring-primary/10"
          title={isWidgetOpen
            ? t("chat_test.widget.close", "Close Live Chat Simulator")
            : t("chat_test.widget.open", "Open Live Chat Simulator")}
        >
          {isWidgetOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageSquare className="w-6 h-6" />
          )}
        </motion.button>
      </div>

      {/* Floating Chat Modal Overlay */}
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="xl:hidden fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[580px] max-h-[80vh] z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-card"
          >
            {renderPreview(() => setIsWidgetOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
