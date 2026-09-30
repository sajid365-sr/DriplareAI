"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, MessageSquare, Sparkles, X, GitCompare, Info, Check } from "lucide-react";
import { ChatSettings } from "./_components/chat-settings";
import { ChatPreview } from "./_components/chat-preview";
import { SetupChecklist } from "./_components/setup-checklist";

/**
 * স্থির (stable) স্ট্রিং — কী-এর ক্রম নির্বিশেষে।
 *
 * dirty-চেকের জন্য দুটো snapshot তুলনা করা হয়, আর সাধারণ `JSON.stringify`
 * এখানে কাজ করত না: `wizardData`-র মতো nested অবজেক্টের key order API থেকে
 * আসা ডেটায় আর wizard-এ তৈরি ডেটায় এক না-ও হতে পারে। তখন কিছুই না বদলেও
 * পেজ "Unsaved changes" দেখাত — অর্থাৎ বাটন চিরকাল চালু থাকত, আর dirty-চেকের
 * কোনো মানেই থাকত না।
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * যে ফিল্ডগুলো `saveSettings` সত্যিই পাঠায় — dirty-চেক কেবল এগুলোর উপর।
 *
 * ইচ্ছাকৃতভাবে পুরো `bot` অবজেক্ট নেওয়া হয় না: API থেকে `_count`, `createdAt`
 * ইত্যাদি আসে যেগুলো কখনো বদলায় না, আর ভবিষ্যতে কেউ এমন কিছু যোগ করলে সেটা
 * অকারণে পেজকে dirty বানাত।
 */
function savableSnapshot(bot: Record<string, unknown> | null) {
  if (!bot) return null;
  return {
    model: bot.model,
    provider: bot.provider,
    temperature: bot.temperature,
    topP: bot.topP,
    maxTokens: bot.maxTokens,
    rawPrompt: bot.rawPrompt ?? bot.systemPrompt,
    compiledPrompt: bot.compiledPrompt,
    promptMode: bot.promptMode,
    wizardData: bot.wizardData,
    name: bot.name,
    chatbotMode: bot.chatbotMode,
  };
}

export default function ChatPage() {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // টেস্টারের দুই উপস্থাপনা — ডেস্কটপের ডান প্যান আর ফ্লোটিং উইজেট — দুটোই
  // DOM-এ থাকে (`hidden` দিয়ে লুকানো, unmount নয়; সাইডবারও একই কায়দা করে),
  // তাই প্রত্যেকের নিজের ref দরকার। একটা ref দুটো জায়গায় বসালে শেষে যেটা
  // render হয় সেটাই ধরা পড়ত, আর অন্যটা স্ক্রল করত না।
  const paneMessagesEndRef = useRef<HTMLDivElement>(null);

  // --- State ---
  const [bot, setBot] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Floating Chat Widget Simulator State
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  // শেষ সেভ করা অবস্থার snapshot। `null` মানে এখনো লোড হয়নি — তখন Save
  // নিষ্ক্রিয় রাখা হয়, নইলে পেজ খোলার সঙ্গে সঙ্গে ভুয়া "unsaved" দেখাত।
  const [baseline, setBaseline] = useState<string | null>(null);
  const isDirty = baseline !== null && stableStringify(savableSnapshot(bot)) !== baseline;

  // --- Effects ---
  useEffect(() => {
    if (chatbotId) fetchBot();
  }, [chatbotId]);

  // দুই ref, দুই উপস্থাপনা। CSS-এ লুকোনো (`display:none`) এলিমেন্টের কোনো
  // box-ই থাকে না, তাই ওই দিকের scrollIntoView নিঃশব্দে কিছুই করে না — অর্থাৎ
  // একই কল দুটো জায়গাতেই নিরাপদ।
  //
  // `block: "nearest"` ইচ্ছাকৃত: ডিফল্ট "start" হলে বাইরের স্ক্রলার (`main`)-ও
  // টেনে নামাত, আর কনফিগ স্ক্রল করতে গিয়ে পেজ হঠাৎ লাফ দিত।
  useEffect(() => {
    const opts = { behavior: "smooth", block: "nearest" } as const;
    messagesEndRef.current?.scrollIntoView(opts);
    paneMessagesEndRef.current?.scrollIntoView(opts);
  }, [messages, sending]);

  // --- Helpers ---
  const fetchBot = async () => {
    try {
      const [botRes, usageRes] = await Promise.all([
        fetch(`/api/chatbots/${chatbotId}`),
        fetch("/api/usage"),
      ]);
      const botData = await botRes.json();
      const usageData = await usageRes.json();

      setBot(botData);
      // baseline ঠিক ওই ডেটা থেকেই — নইলে লোড হওয়া মাত্রই পেজ dirty দেখাত।
      setBaseline(stableStringify(savableSnapshot(botData)));
      if (usageData && usageData.plan) {
        setUserPlan(usageData.plan);
      }
    } catch (err) {
      toast.error(t("chat_test.toast.loadFailed", "Failed to load bot settings"));
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (key: string) => {
    if (key.startsWith("tier|")) {
      const [, tier] = key.split("|");
      setBot((b: any) => ({ ...b, provider: "openrouter", model: tier }));
      return;
    }

    const [provider, model] = key.split("|");
    setBot((b: any) => ({ ...b, provider, model }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: bot.model,
          provider: bot.provider,
          temperature: bot.temperature,
          topP: bot.topP,
          maxTokens: bot.maxTokens,
          rawPrompt: bot.rawPrompt ?? bot.systemPrompt,
          compiledPrompt: bot.compiledPrompt,
          promptMode: bot.promptMode,
          wizardData: bot.wizardData,
          name: bot.name,
          chatbotMode: bot.chatbotMode,
        }),
      });
      if (res.ok) {
        toast.success(t("chat_test.toast.saved", "Settings saved"));
        // সেভ সফল হলেই baseline সরে — ব্যর্থ হলে পেজ dirty-ই থাকে, যা ঠিক,
        // কারণ তখন ডেটাবেসে পুরনোটা পড়ে আছে।
        setBaseline(stableStringify(savableSnapshot(bot)));
      } else toast.error(t("chat_test.toast.saveFailed", "Failed to save settings"));
    } catch {
      toast.error(t("chat_test.toast.saveError", "An error occurred while saving"));
    } finally {
      setSaving(false);
    }
  };

  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    const newId = `test_${Math.random().toString(36).slice(2, 11)}`;
    setSessionId(newId);
    return newId;
  };

  const sendMessage = async (customMessage?: string, attachments?: any[]) => {
    const text = customMessage !== undefined ? customMessage : input;
    if ((!text.trim() && (!attachments || attachments.length === 0)) || sending) return;

    const currentSessionId = ensureSessionId();
    setInput("");
    const userMsg = {
      role: "user" as const,
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: currentSessionId, attachments }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant" as const,
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
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">{t("chat_test.loading", "Loading...")}</div>;
  if (!bot) return <div className="p-8 text-center text-destructive">{t("chat_test.not_found", "Bot not found")}</div>;

  // টেস্টারটা দুই জায়গায় আঁকা হয় (ডান প্যান আর ফ্লোটিং উইজেট), তাই props
  // একবারই লেখা। দুবার লিখলে এক জায়গায় নতুন prop যোগ করলে অন্যটা পিছিয়ে
  // পড়ত, আর "একই" প্রিভিউ দুটো ধীরে ধীরে আলাদা হয়ে যেত।
  // `onClose` শুধু উইজেটে যায় — প্যানে বন্ধ করার কিছু নেই, তাই ওখানে X বাটনটা
  // (ChatPreview নিজেই `onClose` না পেলে আঁকে না) অনুপস্থিত থাকে।
  const renderPreview = (
    endRef: React.RefObject<HTMLDivElement | null>,
    onClose?: () => void
  ) => (
    <ChatPreview
      bot={bot}
      messages={messages}
      input={input}
      sending={sending}
      onInputChange={setInput}
      onSend={sendMessage}
      onReset={() => {
        setMessages([]);
        setSessionId(null);
      }}
      onClose={onClose}
      messagesEndRef={endRef}
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
            onBotChange={(key, val) => setBot((b: any) => ({ ...b, [key]: val }))}
            onModelSelect={handleModelSelect}
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
          {renderPreview(paneMessagesEndRef)}
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
            {renderPreview(messagesEndRef, () => setIsWidgetOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
