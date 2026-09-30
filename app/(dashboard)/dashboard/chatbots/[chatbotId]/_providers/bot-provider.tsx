"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * এজেন্ট-সেকশনের একমাত্র ডেটা-উৎস।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে প্রতিটা পেজ নিজে `GET /api/chatbots/[id]` করত। ফলে Setup → Playground →
 * Analytics যাওয়ার প্রতিবারই একই ডেটা আবার আসত, আর মাঝখানে `loading` স্ক্রিন
 * দেখাত — অথচ বদলাচ্ছিল শুধু ট্যাব। এখন ফেচটা `[chatbotId]/layout.tsx`-এ,
 * অর্থাৎ সেকশনের শিকড়ে: Next.js ট্যাব বদলালে layout-টা ধরে রাখে, তাই ডেটাও
 * ধরে রাখে — লোডিং স্ক্রিন আর ফিরে আসে না।
 *
 * ⚠️ `isDirty` আর `saveSettings`-ও এখানে, পেজে নয়। কারণ "টেস্টার সেভ করা
 *    সেটিংসেই চলে" — এটা টেস্টারের নিজের সত্য। টেস্টার যে কম্পোনেন্টেই আঁকা
 *    হোক (Setup-এর ফ্লোটিং বাবল হোক বা Playground-এর পেজ), সে একই সূত্র থেকে
 *    জানতে পারবে সেভ হয়ে গেছে কি না — দুই জায়গায় দুই হিসাব থাকবে না।
 */

/**
 * এজেন্টের যেসব ফিল্ড UI সত্যিই পড়ে বা লেখে।
 *
 * পুরো Prisma মডেল নয় — কারণ API response-এ `_count`, `createdAt` ইত্যাদি
 * আসে যেগুলো কেউ পড়ে না, অথচ টাইপে থাকলে `bot.` লিখলেই সেগুলোও বৈধ মনে হত।
 */
export interface BotRecord {
  chatbotId?: string;
  name?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  rawPrompt?: string;
  systemPrompt?: string;
  compiledPrompt?: string;
  promptMode?: string;
  wizardData?: unknown;
  chatbotMode?: string;
  // অ্যাভাটারের এতোগুলো নাম পুরনো দিনের উত্তরাধিকার — কোন পেজ কোন নামে
  // সেভ করেছিল তার ভিত্তিতে UI একেকটা পড়ে। সবগুলো এখানে রাখা হয়েছে যাতে
  // টাইপ জানার পরও টেস্টার আগের মতোই সবগুলো চেষ্টা করতে পারে।
  avatarUrl?: string | null;
  avatarBase64?: string;
  logoUrl?: string;
  logo?: string;
  avatar?: string;
  image?: string;
  sourceCount?: number;
  sources?: unknown[];
  knowledgeBases?: unknown[];
  _count?: {
    sources?: number;
    faqs?: number;
    sampleReplies?: number;
    knowledgeBases?: number;
  };
}

interface BotContextValue {
  bot: BotRecord | null;
  loading: boolean;
  saving: boolean;
  /** সেভ করা অবস্থার সাথে ফর্মের অমিল আছে কি না। */
  isDirty: boolean;
  userPlan: string;
  saveSettings: () => Promise<void>;
  /** একটা ফিল্ড বদলায় — `ChatSettings`-এর `onBotChange(key, value)` সোজা এখানে। */
  patchBot: (key: string, value: unknown) => void;
  /** মডেল কার্ড/সারির কী → `provider` + `model`। `tier|fast` মানে preset। */
  selectModel: (key: string) => void;
}

/** Provider-এর বাইরে `useBot()` ডাকলে ভাঙার বদলে নিরীহ ডিফল্ট। */
const BotContext = createContext<BotContextValue>({
  bot: null,
  loading: true,
  saving: false,
  isDirty: false,
  userPlan: "starter",
  saveSettings: async () => {},
  patchBot: () => {},
  selectModel: () => {},
});

export function useBot() {
  return useContext(BotContext);
}

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
 * যে ফিল্ডগুলো সেভ করা হয় — dirty-চেকও কেবল এগুলোর উপর।
 *
 * ইচ্ছাকৃতভাবে পুরো `bot` অবজেক্ট নেওয়া হয় না: API থেকে `_count`, `createdAt`
 * ইত্যাদি আসে যেগুলো কখনো বদলায় না, আর ভবিষ্যতে কেউ এমন কিছু যোগ করলে সেটা
 * অকারণে পেজকে dirty বানাত।
 *
 * ⚠️ এই অবজেক্টটাই সোজা `PUT`-এর body — আগে পেজে হাতে লেখা একটা লিস্ট ছিল,
 *    আর dirty-হিসাবের আরেকটা। দুটো আলাদা থাকলে একদিন একটা ফিল্ড এক জায়গায়
 *    যোগ হয়ে অন্যটায় না হয়ে হত — অর্থাৎ যা সেভ হয় না, তা dirty-ও দেখাত না।
 */
function savableSnapshot(bot: BotRecord | null) {
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

export function BotProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const chatbotId = params?.chatbotId as string | undefined;
  const { t } = useTranslation("chatbots");

  const [bot, setBot] = useState<BotRecord | null>(null);
  const [userPlan, setUserPlan] = useState("starter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // শেষ সেভ করা অবস্থার snapshot। `null` মানে এখনো লোড হয়নি — তখন Save নিষ্ক্রিয়,
  // নইলে পেজ খোলার সঙ্গে সঙ্গে ভুয়া "unsaved" দেখাত।
  const [baseline, setBaseline] = useState<string | null>(null);

  const isDirty = baseline !== null && stableStringify(savableSnapshot(bot)) !== baseline;

  // লোড আর ব্যর্থতার-বার্তা — দুইটা আলাদা effect, ইচ্ছাকৃতভাবে।
  //
  // কারণ: বার্তাটা অনূদিত, অর্থাৎ ওই effect-এর dependency-তে `t` থাকবে, আর
  // `t`-এর পরিচয় ভাষা বদলালেই বদলায়। যদি ফেচটাও ওই একই effect-এ থাকত, তবে
  // ভাষা টগল করলেই bot আবার fetch হত, আর `setBot` সেভ-না-করা সব সম্পাদনা মুছে
  // দিত। ভাষা বদলানো কখনোই ডেটা হারানোর কারণ হওয়া উচিত নয় — তাই ফেচ-এর
  // effect-এ কেবল `chatbotId`, আর বার্তার effect-এ কেবল `loadError`.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!chatbotId) return;
    // দেরিতে আসা উত্তরে state লেখা আটকায় — নইলে দ্রুত এজেন্ট বদলালে আগের
    // এজেন্টের ডেটা এসে পরের জনের উপর বসে যেত।
    let cancelled = false;

    (async () => {
      try {
        const [botRes, usageRes] = await Promise.all([
          fetch(`/api/chatbots/${chatbotId}`),
          fetch("/api/usage"),
        ]);
        const botData = await botRes.json();
        const usageData = await usageRes.json();
        if (cancelled) return;

        setBot(botData);
        // baseline ঠিক ওই ডেটা থেকেই — নইলে লোড হওয়া মাত্রই পেজ dirty দেখাত।
        setBaseline(stableStringify(savableSnapshot(botData)));
        if (usageData?.plan) setUserPlan(usageData.plan);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // এখানে `t` কোথাও পড়া হয় না — ইচ্ছাকৃত। ভাষা-নির্ভর লেখাটা নিচের effect-এ,
    // তাই এই effect-এর চাবি কেবল `chatbotId`: ভাষা বদলালে ডেটা আবার আসে না,
    // আর সেভ-না-করা সম্পাদনাও মুছে যায় না।
  }, [chatbotId]);

  useEffect(() => {
    if (loadError) toast.error(t("chat_test.toast.loadFailed", "Failed to load bot settings"));
  }, [loadError, t]);

  const saveSettings = useCallback(async () => {
    if (!chatbotId || !bot) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savableSnapshot(bot)),
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
  }, [bot, chatbotId, t]);

  const patchBot = useCallback((key: string, value: unknown) => {
    // একটা ফিল্ডের নাম ধরে লেখা — তাই এখানে একটা cast অনিবার্য, আর সেটা এই
    // ফাংশনের ভেতরেই আটকে থাকে। বাইরে সবাই টাইপ-নিরাপদ API-ই দেখে।
    setBot((prev) => ({ ...(prev ?? {}), [key]: value }) as BotRecord);
  }, []);

  const selectModel = useCallback(
    (key: string) => {
      if (key.startsWith("tier|")) {
        const [, tier] = key.split("|");
        patchBot("provider", "openrouter");
        patchBot("model", tier);
        return;
      }
      const [provider, model] = key.split("|");
      patchBot("provider", provider);
      patchBot("model", model);
    },
    [patchBot]
  );

  const value = useMemo<BotContextValue>(
    () => ({ bot, loading, saving, isDirty, userPlan, saveSettings, patchBot, selectModel }),
    [bot, loading, saving, isDirty, userPlan, saveSettings, patchBot, selectModel]
  );

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}
