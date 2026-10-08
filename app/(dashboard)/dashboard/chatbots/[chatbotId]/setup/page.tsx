"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Save, Loader2, Info, Check, MessageSquare } from "lucide-react";
import { ChatSettings } from "./_components/chat-settings";
import { SetupChecklist } from "./_components/setup-checklist";
import { useBot } from "../_providers/bot-provider";

/**
 * The agent's Setup — every configuration in one full-width page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This page is the old `/playground`. The rename happened because 90% of what went
 * on there was setup — model, prompt, wizard, checklist — while the name "Playground"
 * sent users looking for a place to try things out, which was not there.
 *
 * The tester panel on the right is gone too. At 360px it was cramped — yet testing is
 * one of this page's most useful jobs. With the Playground toggle on, the tester now
 * lives in the corner bubble (`LiveWidget`, supplied by the shell) — and the whole
 * page is configuration.
 */
export default function SetupPage() {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");
  const { bot, loading, saving, isDirty, userPlan, saveSettings, patchBot, selectModel } = useBot();

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("chat_test.loading", "Loading...")}</div>;
  if (!bot) return <div className="p-8 text-center text-destructive">{t("chat_test.not_found", "Bot not found")}</div>;

  return (
    // `pb-24` — কোণার টেস্টার-বাবল যাতে শেষ কার্ডের শেষ সারিটা ঢেকে না দেয়।
    <div className="space-y-6 pb-24">
      {/* ─── Header row ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {t("chat_test.title", "Setup")}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
            {t("chat_test.subtitle", "Teach your agent about your business, choose a model, and shape its prompt to match.")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* টেস্টার এখন আলাদা পেজ, তাই এখান থেকে ওখানে যাওয়ার পথ থাকা দরকার —
              নইলে Setup-এ বসে পরখ করার কোনো উপায়ই থাকত না (বাবল ছাড়া)। */}
          <Link
            href={`/dashboard/chatbots/${chatbotId}/playground`}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-all active:scale-95"
            data-testid="open-playground"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{t("chat_test.openTester", "Try it in Playground")}</span>
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

      {/* ─── Setup checklist ───────────────────────────────────────── */}
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
  );
}
