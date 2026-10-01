"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  DEFAULT_MODEL_KEY,
  FALLBACK_CHAT_MODELS,
  getModelKey,
  useOpenRouterModels,
} from "@/components/chatbots/use-openrouter-models";
import { LockedContent, LockedOverlay, proModeLock } from "@/components/chatbots/LockedOverlay";
import { useRegion } from "@/components/region-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from "@/lib/domain/compare-config";

import { useBot } from "../../../_providers/bot-provider";
import { ArenaGrid } from "./arena-grid";
import { ArenaInput } from "./arena-input";
import { ArenaToolbar } from "./arena-toolbar";
import { CompareHistory } from "./compare-history";
import { parseCompareHistory } from "./history-parser";
import type { CompareChatMessage, CompareReply, CompareSession } from "./types";

/** শুরুর দুই কলাম — প্রথম দুটো fallback মডেল */
const INITIAL_SLOTS = [
  DEFAULT_MODEL_KEY,
  getModelKey(FALLBACK_CHAT_MODELS[1] || FALLBACK_CHAT_MODELS[0]),
];

/**
 * প্রতি তুলনার জন্য আলাদা session id — ইতিহাসে সেশনগুলো এতেই আলাদা থাকে।
 * `useState`-এর lazy initializer আর "Reset Arena" দুটোই এটাই ব্যবহার করে,
 * তাই আইডি-তৈরির নিয়মটা এক জায়গায় থাকে।
 */
function makeSessionId() {
  return `compare_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * CompareArena — এক প্রশ্ন, ২–৪টা মডেল, পাশাপাশি উত্তর।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ পুরো এরিনা **Pro-only**, আংশিক নয়। কারণ এখানে মডেলের id সোজা ক্লায়েন্ট
 *    পাঠায় — অর্থাৎ "নিজে মডেল বাছা", যেটাই Pro মোডের সংজ্ঞা। Starter-এর জন্য
 *    দুই কলাম খুলে দিলে সেটাই হত: Pro-এর একমাত্র চিহ্নটা তুলে দেওয়া। তাই
 *    Starter পুরোটা blur দেখে, আর `LockedOverlay` সোজা upgrade-এর রাস্তা দেয়।
 *
 *    সার্ভারেও একই সীমানা (`checkProModeAccess`) — এখানকার তালা কেবল
 *    জানানোর জন্য, আটকানোর দায়িত্ব ওখানে। n8n-এর production reply-পথ আলাদা,
 *    তাই ওটা এই গেটের উপর নির্ভর করে না।
 */
export function CompareArena() {
  const params = useParams();
  const { t } = useTranslation("chatbots");
  const chatbotId = params?.chatbotId as string;
  const confirm = useConfirm((state) => state.confirm);
  const { region } = useRegion();

  // bot আর plan শেল থেকে (`[chatbotId]/layout.tsx`) — এই পেজ আর নিজে
  // `GET /api/chatbots/[id]` করে না।
  const { userPlan } = useBot();
  const { models, grouped, loading: loadingModels, multiplier } = useOpenRouterModels();

  const [slots, setSlots] = useState<string[]>(INITIAL_SLOTS);
  const [conversation, setConversation] = useState<CompareChatMessage[]>([]);
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [sessions, setSessions] = useState<CompareSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const newSessionId = useCallback(() => setSessionId(makeSessionId()), []);

  /**
   * সেশন-তালিকা আনে — কেবল দরকারে (ইতিহাস খোলা, refresh, নতুন তুলনা, ডিলিট)।
   *
   * ⚠️ mount-এ **আনা হয় না**। ড্রয়ারটা ডিফল্টে বন্ধ, তাই বেশিরভাগ ভিজিটে এই
   *    GET-টা নিছক অপচয় হত। তার চেয়ে বড় কারণ: effect-এর synchronous বডিতে
   *    setState-কারী ফাংশন ডাকলে React বাড়তি রেন্ডার করে, আর eslint-এর
   *    `react-hooks/set-state-in-effect` সেটাই ধরে — ড্রয়ার খোলার ক্লিক থেকে
   *    ডাকা হলে সেটা সাধারণ event handler, কোনো চক্র নেই।
   */
  const fetchSessions = useCallback(async () => {
    if (!chatbotId) return;

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(
          (data.sessions || []).filter((s: CompareSession) => s.platform === "compare")
        );
      }
    } catch (err) {
      console.error("Failed to fetch compare sessions", err);
    }
  }, [chatbotId]);

  /** ব্যবহারকারীর চোখে পড়া প্রতিটি পথ — স্পিনারসহ। */
  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      await fetchSessions();
    } finally {
      setLoadingSessions(false);
    }
  }, [fetchSessions]);

  // --- কলাম যোগ/বদল/সরা ---
  const setCount = (count: number) => {
    setSlots((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);

      // বাড়ানোর সময় খালি সিলেক্টর না দিয়ে এমন মডেল দেওয়া হয় যেটা এখনো নেই
      const next = [...prev];
      for (const m of models) {
        if (next.length >= count) break;
        const key = getModelKey(m);
        if (!next.includes(key)) next.push(key);
      }
      return next;
    });
  };

  const setSlot = (index: number, value: string) =>
    setSlots((prev) => prev.map((v, i) => (i === index ? value : v)));

  const removeSlot = (index: number) =>
    setSlots((prev) =>
      prev.length <= MIN_COMPARE_MODELS ? prev : prev.filter((_, i) => i !== index)
    );

  // একই মডেল দুই কলামে — তুলনা নয়, শুধু credit খরচ। তাই পাঠানো হয় না।
  const hasDuplicates = new Set(slots).size !== slots.length;

  // পাঠানোর **আগে** খরচ — সার্ভারের সূত্রেই (`resolveCompareCredits`): সব
  // মডেলের base credit যোগ, তারপর একবার টেস্ট-চ্যাট গুণক।
  const costCredits = useMemo(() => {
    const base = slots.reduce((sum, key) => {
      const found = models.find((m) => getModelKey(m) === key);
      return sum + (found?.credits ?? 0);
    }, 0);
    return Math.round(base * multiplier);
  }, [slots, models, multiplier]);

  // --- তুলনা চালানো ---
  const run = async () => {
    if (!msg.trim() || busy || hasDuplicates) return;
    const userMessageText = msg;
    setMsg("");
    setBusy(true);

    setConversation((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessageText,
        timestamp: new Date(),
      },
    ]);

    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageText,
          sessionId,
          models: slots.map((key) => {
            const [provider, model] = key.split("|");
            return { provider, model };
          }),
        }),
      });

      const data = await r.json();
      if (r.ok) {
        // ⚠️ সার্ভার অনুরোধের ক্রমেই ফেরত দেয়, তাই index মিলিয়ে বসানো হয় —
        //    নইলে C কলামে B-র উত্তর দেখাত।
        const replies: CompareReply[] = (data.replies ?? []).map(
          (reply: { label?: string; content?: string }, i: number) => ({
            key: slots[i] ?? "",
            label: reply.label || models.find((m) => getModelKey(m) === slots[i])?.label || "",
            content: reply.content || "",
          })
        );

        setConversation((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", replies, timestamp: new Date() },
        ]);
        fetchSessions();
      } else {
        toast.error(data.error || t("compare.failed", "Compare failed"));
        setConversation((prev) => prev.slice(0, -1));
      }
    } catch {
      toast.error(t("compare.failed", "Compare failed"));
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setConversation([]);
    setSlots(INITIAL_SLOTS);
    newSessionId();
    toast.success(t("compare.reset_done", "Arena reset"));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(t("compare.copied", "Copied to clipboard!"));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // --- ইতিহাস ---
  const loadSession = async (sId: string) => {
    try {
      setLoadingMessages(true);
      setSessionId(sId);
      const res = await fetch(`/api/chatbots/${chatbotId}/messages?sessionId=${sId}`);
      if (!res.ok) {
        toast.error(t("compare.load_failed", "Failed to load conversation"));
        return;
      }

      const dbMessages = await res.json();
      const { conversation: parsed, slots: restored } = parseCompareHistory(dbMessages, models);
      setConversation(parsed);

      // মডেল-সিলেক্টরগুলো আগের সেশনের অবস্থায় ফেরানো।
      // ⚠️ label→key মেলানো না গেলে (admin মডেলটার নাম বদলেছে, বা তালিকা এখনো
      //    লোড হয়নি) খালি key বাদ পড়ে — ভুল মডেল বসানোর চেয়ে পুরনো কলাম থাকা ভালো।
      const usable = restored.filter(Boolean).slice(0, MAX_COMPARE_MODELS);
      if (usable.length >= MIN_COMPARE_MODELS) setSlots(usable);

      toast.success(t("compare.loaded", "Conversation loaded"));
    } catch (err) {
      console.error(err);
      toast.error(t("compare.load_failed", "Failed to load conversation"));
    } finally {
      setLoadingMessages(false);
    }
  };

  const deleteSession = (sId: string) => {
    confirm("Delete Chat Session", "Are you sure? This action cannot be undone.", async () => {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success(t("compare.deleted", "Session deleted"));
          fetchSessions();
          if (sessionId === sId) {
            setConversation([]);
            newSessionId();
          }
        } else {
          toast.error(t("compare.delete_failed", "Failed to delete session"));
        }
      } catch (err) {
        console.error(err);
        toast.error(t("compare.delete_failed", "Failed to delete session"));
      }
    });
  };

  // Pro gate. ⚠️ `userPlan` খালি মানে plan এখনো আসেনি — তখন তালা দেখানো হয় না,
  // কারণ মুহূর্তের জন্য Pro ব্যবহারকারীর গায়ে ভুয়া তালা বসানো মিথ্যা নিষেধ।
  const { locked, requiredPlan } = proModeLock(userPlan, region);
  const gated = Boolean(userPlan) && locked;

  if (gated) {
    // Starter-এর জন্য এরিনা একেবারেই নেই — খালি কলাম বা নিষ্ক্রিয় টুলবার
    // আঁকলে মনে হত কিছু ভেঙেছে। কেবল আকারটুকু blur হয়ে থাকে, আর তার উপরে
    // একটাই স্পষ্ট কথা: এটা Pro-এর সুবিধা, আর এখান থেকে upgrade-এর রাস্তা।
    return (
      <div className="relative">
        <LockedContent locked>
          <ArenaGrid
            slots={slots}
            conversation={[]}
            busy={false}
            loadingMessages={false}
            loadingModels={false}
            copiedKey={null}
            openSlot={null}
            models={models}
            groupedModels={grouped}
            onSlotChange={() => undefined}
            onOpenSlotChange={() => undefined}
            onRemoveSlot={() => undefined}
            onCopy={() => undefined}
          />
        </LockedContent>
        <LockedOverlay requiredPlan={requiredPlan} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ArenaToolbar
        count={slots.length}
        chatbotId={chatbotId}
        onCountChange={setCount}
        onReset={handleReset}
      />

      {/* এক লাইনের প্রশ্ন — চাপলে সব কলাম একসাথে উত্তর দেয় */}
      <ArenaInput
        value={msg}
        onChange={setMsg}
        onSubmit={run}
        busy={busy}
        loadingMessages={loadingMessages}
        loadingModels={loadingModels}
        costCredits={costCredits}
        modelCount={slots.length}
        duplicateSelection={hasDuplicates}
      />

      <ArenaGrid
        slots={slots}
        conversation={conversation}
        busy={busy}
        loadingMessages={loadingMessages}
        loadingModels={loadingModels}
        copiedKey={copiedKey}
        openSlot={openSlot}
        models={models}
        groupedModels={grouped}
        onSlotChange={setSlot}
        onOpenSlotChange={setOpenSlot}
        onRemoveSlot={removeSlot}
        onCopy={handleCopy}
      />

      {slots.length < MAX_COMPARE_MODELS && (
        <Button
          variant="outline"
          onClick={() => setCount(slots.length + 1)}
          data-testid="compare-add-model"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-dashed border-border/80 font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          {t("compare.add_model", {
            max: MAX_COMPARE_MODELS,
            defaultValue: "Add another model to compare (up to {{max}})",
          })}
        </Button>
      )}

      <CompareHistory
        sessions={sessions}
        activeSessionId={sessionId}
        loadingSessions={loadingSessions}
        loadingMessages={loadingMessages}
        onOpen={refreshSessions}
        onRefresh={refreshSessions}
        onView={loadSession}
        onDelete={deleteSession}
      />
    </div>
  );
}
