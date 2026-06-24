"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/ai/chat-models";
import { useConfirm } from "@/hooks/use-confirm";
import { useTranslation } from "react-i18next";

import { CompareHeader } from "./_components/compare-header";
import { ComparePanel } from "./_components/compare-panel";
import { CompareInput } from "./_components/compare-input";
import { CompareHistoryTable } from "./_components/compare-history-table";
import { CompareChatMessage, CompareSession } from "./_components/compare-types";

export default function Compare() {
  const params = useParams();
  const { t } = useTranslation("chatbots");
  const chatbotId = params?.chatbotId as string;
  const confirm = useConfirm((state) => state.confirm);

  // --- States ---
  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [a, setA] = useState(`${DEFAULT_CHAT_MODEL.provider}|${DEFAULT_CHAT_MODEL.model}`);
  const [b, setB] = useState(
    `${CHAT_MODELS[1]?.provider || DEFAULT_CHAT_MODEL.provider}|${CHAT_MODELS[1]?.model || DEFAULT_CHAT_MODEL.model}`
  );
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const [msg, setMsg] = useState("");
  const [conversation, setConversation] = useState<CompareChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copiedIndexA, setCopiedIndexA] = useState<number | null>(null);
  const [copiedIndexB, setCopiedIndexB] = useState<number | null>(null);

  // --- Compare Sessions list ---
  const [sessions, setSessions] = useState<CompareSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // --- Initialize Session ID & Load History ---
  useEffect(() => {
    generateNewSession();
    if (chatbotId) {
      fetchSessions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId]);

  const generateNewSession = () => {
    const newId = `compare_${Math.random().toString(36).substring(2, 15)}`;
    setSessionId(newId);
  };

  // --- Fetch Bot Info ---
  useEffect(() => {
    if (chatbotId) fetchBot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId]);

  const fetchBot = async () => {
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}`);
      if (res.ok) {
        const data = await res.json();
        setBot(data);
      } else {
        toast.error("Failed to load chatbot details");
      }
    } catch {
      toast.error("An error occurred while fetching bot details");
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch Compare Sessions ---
  const fetchSessions = async () => {
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
  };

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
      const parsed: CompareChatMessage[] = [];

      for (const m of dbMessages) {
        if (m.role === "user") {
          parsed.push({
            id: m.id,
            role: "user",
            contentA: m.content,
            contentB: m.content,
            timestamp: new Date(m.timestamp),
          });
        } else if (m.role === "assistant") {
          const match = m.content.match(/^\[([^\]]+)\]:\s*([\s\S]*)$/);
          const label = match ? match[1] : "";
          const text = match ? match[2] : m.content;

          const lastItem = parsed[parsed.length - 1];
          if (lastItem && lastItem.role === "assistant") {
            if (!lastItem.contentB) {
              lastItem.contentB = text;
              lastItem.modelB = label;
            }
          } else {
            parsed.push({
              id: m.id,
              role: "assistant",
              contentA: text,
              modelA: label,
              timestamp: new Date(m.timestamp),
            });
          }
        }
      }

      setConversation(parsed);

      // Auto-update model dropdowns from first assistant message labels
      const firstAssistant = parsed.find((m) => m.role === "assistant");
      if (firstAssistant) {
        const matchA = CHAT_MODELS.find((m) => m.label === firstAssistant.modelA);
        if (matchA) setA(`${matchA.provider}|${matchA.model}`);
        const matchB = CHAT_MODELS.find((m) => m.label === firstAssistant.modelB);
        if (matchB) setB(`${matchB.provider}|${matchB.model}`);
      }

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

  // --- Run Comparison ---
  const run = async () => {
    if (!msg.trim() || busy) return;
    const userMessageText = msg;
    setMsg("");
    setBusy(true);

    const labelA = CHAT_MODELS.find((m) => `${m.provider}|${m.model}` === a)?.label || "Model A";
    const labelB = CHAT_MODELS.find((m) => `${m.provider}|${m.model}` === b)?.label || "Model B";

    const userTurn: CompareChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      contentA: userMessageText,
      contentB: userMessageText,
      timestamp: new Date(),
    };
    setConversation((prev) => [...prev, userTurn]);

    try {
      const [pa, ma] = a.split("|");
      const [pb, mb] = b.split("|");
      const r = await fetch(`/api/chatbots/${chatbotId}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageText,
          providerA: pa,
          modelA: ma,
          providerB: pb,
          modelB: mb,
          sessionId,
        }),
      });

      const data = await r.json();
      if (r.ok) {
        const assistantTurn: CompareChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          contentA: data.a || "",
          contentB: data.b || "",
          modelA: labelA,
          modelB: labelB,
          timestamp: new Date(),
        };
        setConversation((prev) => [...prev, assistantTurn]);
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
  const makeCopyHandler = (setCopied: (idx: number | null) => void) =>
    (text: string, index: number) => {
      navigator.clipboard.writeText(text);
      setCopied(index);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(null), 2000);
    };

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
      />

      {/* Two Model Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ComparePanel
          panelKey="a"
          value={a}
          onValueChange={setA}
          open={openA}
          onOpenChange={setOpenA}
          conversation={conversation}
          busy={busy}
          loadingMessages={loadingMessages}
          copiedIndex={copiedIndexA}
          onCopy={makeCopyHandler(setCopiedIndexA)}
        />
        <ComparePanel
          panelKey="b"
          value={b}
          onValueChange={setB}
          open={openB}
          onOpenChange={setOpenB}
          conversation={conversation}
          busy={busy}
          loadingMessages={loadingMessages}
          copiedIndex={copiedIndexB}
          onCopy={makeCopyHandler(setCopiedIndexB)}
        />
      </div>

      {/* Message Input */}
      <CompareInput
        value={msg}
        onChange={setMsg}
        onSubmit={run}
        busy={busy}
        loadingMessages={loadingMessages}
      />

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
