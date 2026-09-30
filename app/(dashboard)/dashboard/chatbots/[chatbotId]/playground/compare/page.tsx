"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
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
import { useTranslation } from "react-i18next";
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from "@/lib/domain/compare-config";

import { useBot } from "../../_providers/bot-provider";
import { CompareHeader } from "./_components/compare-header";
import { ComparePanel } from "./_components/compare-panel";
import { CompareInput } from "./_components/compare-input";
import { CompareHistoryTable } from "./_components/compare-history-table";
import { parseCompareHistory } from "./_components/compare-history";
import { CompareChatMessage, CompareReply, CompareSession } from "./_components/compare-types";

/**
 * কলাম-সংখ্যা অনুযায়ী গ্রিড।
 *
 * ⚠️ `grid-cols-${n}` লেখা যেত না — Tailwind v4 সোর্স **লেখা** স্ক্যান করে
 *    ক্লাস খোঁজে, তাই গড়ে-তোলা নাম কখনো CSS-এ পৌঁছাত না। পুরো নামগুলো এখানে
 *    হুবহু থাকতে হয়।
 *
 * ⚠️ মোবাইলে সবসময় এক কলাম: ৩৭৫px-এ চারটে পাশাপাশি কলাম মানে প্রতি কলামে
 *    ~৮০px — অর্থাৎ পড়া অসম্ভব। তাই ফোনে সাজানো (stacked), আর চওড়া স্ক্রিনে
 *    পাশাপাশি; ৩/৪ কলাম কেবল xl-এ, কারণ ১২৮০px-এর নিচে চার কলামে উত্তর
 *    কাটাকাটি হয়ে যায়।
 */
const GRID_COLUMNS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

/** শুরুর দুই কলাম — প্রথম দুটো fallback মডেল */
const INITIAL_SLOTS = [
  DEFAULT_MODEL_KEY,
  getModelKey(FALLBACK_CHAT_MODELS[1] || FALLBACK_CHAT_MODELS[0]),
];

export default function Compare() {
  const params = useParams();
  const { t } = useTranslation("chatbots");
  const chatbotId = params?.chatbotId as string;
  const confirm = useConfirm((state) => state.confirm);
  const { region } = useRegion();

  // ⚠️ bot আর plan এখন শেল থেকে (`[chatbotId]/layout.tsx`) — এই পেজ আর নিজে
  //    `GET /api/chatbots/[id]` করে না। ফলে ট্যাব বদলে এখানে ঢুকলে লোডিং
  //    স্ক্রিন আসে না, আর plan-টা সেই একই উৎস থেকে আসে যা বাকি ড্যাশবোর্ড দেখে।
  const { bot, userPlan, loading } = useBot();
  const { models, grouped, loading: loadingModels, multiplier } = useOpenRouterModels();

  // --- Model slots (২–৪ কলাম) ---
  const [slots, setSlots] = useState<string[]>(INITIAL_SLOTS);

  // --- Chat state ---
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [conversation, setConversation] = useState<CompareChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- Compare Sessions list ---
  const [sessions, setSessions] = useState<CompareSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const generateNewSession = useCallback(() => {
    setSessionId(`compare_${Math.random().toString(36).substring(2, 15)}`);
  }, []);

  // --- Fetch Compare Sessions ---
  const fetchSessions = useCallback(async () => {
    if (!chatbotId) return;

    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        const allSessions = data.sessions || [];
        setSessions(allSessions.filter((s: CompareSession) => s.platform === "compare"));
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    generateNewSession();
    fetchSessions();
  }, [generateNewSession, fetchSessions]);

  // --- Load Past Session ---
  const loadSession = async (sId: string) => {
    try {
      setLoadingMessages(true);
      setSessionId(sId);
      const res = await fetch(`/api/chatbots/${chatbotId}/messages?sessionId=${sId}`);
      if (!res.ok) {
        toast.error("Failed to load conversation");
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

      toast.success("Conversation loaded");
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while loading conversation");
    } finally {
      setLoadingMessages(false);
    }
  };

  // --- Delete Session ---
  const deleteSession = (sId: string) => {
    confirm("Delete Chat Session", "Are you sure? This action cannot be undone.", async () => {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Session deleted successfully");
          fetchSessions();
          if (sessionId === sId) {
            setConversation([]);
            generateNewSession();
          }
        } else {
          toast.error("Failed to delete session");
        }
      } catch (err) {
        console.error(err);
        toast.error("An error occurred while deleting the session");
      }
    });
  };

  // --- Slot add / update / remove ---
  const addSlot = () => {
    setSlots((prev) => {
      if (prev.length >= MAX_COMPARE_MODELS) return prev;
      // যে মডেলগুলো এখনো নেই তাদের প্রথমটা — ব্যবহারকারীকে খালি সিলেক্টর
      // উপহার দেওয়ার চেয়ে একটা কাজ করা মডেল দেওয়া ভালো।
      const next =
        models.find((m) => !prev.includes(getModelKey(m))) ?? models[0];
      return next ? [...prev, getModelKey(next)] : prev;
    });
  };

  const setSlot = (index: number, value: string) =>
    setSlots((prev) => prev.map((v, i) => (i === index ? value : v)));

  const removeSlot = (index: number) =>
    setSlots((prev) => (prev.length <= MIN_COMPARE_MODELS ? prev : prev.filter((_, i) => i !== index)));

  // দুটো কলামে একই মডেল — তুলনা নয়, শুধু credit নষ্ট। তাই পাঠানো হয় না।
  const hasDuplicates = new Set(slots).size !== slots.length;

  // --- Pre-send cost ---
  // সার্ভারের সূত্রেই (`resolveCompareCredits`): সব মডেলের base credit যোগ,
  // তারপর একবার টেস্ট-চ্যাট গুণক।
  const costCredits = useMemo(() => {
    const base = slots.reduce((sum, key) => {
      const found = models.find((m) => getModelKey(m) === key);
      return sum + (found?.credits ?? 0);
    }, 0);
    return Math.round(base * multiplier);
  }, [slots, models, multiplier]);

  // --- Run Comparison ---
  const run = async () => {
    if (!msg.trim() || busy) return;
    const userMessageText = msg;
    setMsg("");
    setBusy(true);

    const userTurn: CompareChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessageText,
      timestamp: new Date(),
    };
    setConversation((prev) => [...prev, userTurn]);

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

  // --- Reset Chat ---
  const handleReset = () => {
    setConversation([]);
    generateNewSession();
    toast.success("Chat reset successfully");
  };

  // --- Copy handler ---
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Pro gate. ⚠️ `userPlan` খালি থাকা মানে plan এখনো আসেনি — তখন তালা দেখানো
  // হয় না, কারণ মুহূর্তের জন্য Pro ব্যবহারকারীর গায়ে ভুয়া তালা বসানো মিথ্যা
  // নিষেধ। আসল সীমানা সার্ভারে (`checkProModeAccess`), এটা কেবল জানানো।
  const { locked, requiredPlan } = proModeLock(userPlan, region);
  const gated = Boolean(userPlan) && locked;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading comparison playground...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto px-1 pb-10"
    >
      {/* Header */}
      <CompareHeader
        botName={bot?.name}
        chatbotId={chatbotId}
        onReset={handleReset}
        modelCount={slots.length}
      />

      <div className="relative">
        <LockedContent locked={gated} className="space-y-6">
          {/* Model Panels — এক কলামে ২ থেকে ৪টা */}
          <div className={`grid grid-cols-1 gap-6 ${GRID_COLUMNS[slots.length] ?? GRID_COLUMNS[2]}`}>
            {slots.map((value, index) => (
              <ComparePanel
                key={index}
                index={index}
                value={value}
                onValueChange={(v) => setSlot(index, v)}
                open={openSlot === index}
                onOpenChange={(open) => setOpenSlot(open ? index : null)}
                conversation={conversation}
                busy={busy}
                loadingMessages={loadingMessages}
                copiedKey={copiedKey}
                onCopy={handleCopy}
                models={models}
                groupedModels={grouped}
                loadingModels={loadingModels}
                onRemove={slots.length > MIN_COMPARE_MODELS ? () => removeSlot(index) : undefined}
              />
            ))}
          </div>

          {/* আরেকটা মডেল যোগ করা */}
          {slots.length < MAX_COMPARE_MODELS && (
            <Button
              variant="outline"
              onClick={addSlot}
              data-testid="compare-add-model"
              className="w-full h-12 rounded-2xl border-dashed border-border/80 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("compare.add_model", {
                max: MAX_COMPARE_MODELS,
                defaultValue: "Add another model to compare (up to {{max}})",
              })}
            </Button>
          )}

          {/* Message Input */}
          <CompareInput
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
        </LockedContent>

        {gated && <LockedOverlay requiredPlan={requiredPlan} />}
      </div>

      {/* Session History Table */}
      <CompareHistoryTable
        sessions={sessions}
        activeSessionId={sessionId}
        loadingSessions={loadingSessions}
        loadingMessages={loadingMessages}
        onRefresh={fetchSessions}
        onView={loadSession}
        onDelete={deleteSession}
      />
    </motion.div>
  );
}
