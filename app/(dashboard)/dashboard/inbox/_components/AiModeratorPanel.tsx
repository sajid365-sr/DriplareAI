"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, MessageSquare, Send, HelpCircle, Loader2, Copy, Check, ArrowRight, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";

interface AiModeratorPanelProps {
  chatbotId: string | null;
  sessionId: string;
  onApplySuggestedReply?: (text: string) => void;
}

type ModeTab = "summary" | "qa" | "suggest_reply";

export const AiModeratorPanel = ({
  chatbotId,
  sessionId,
  onApplySuggestedReply,
}: AiModeratorPanelProps) => {
  const { t } = useTranslation("live-inbox");
  const [activeTab, setActiveTab] = useState<ModeTab>("summary");
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestedReply, setSuggestedReply] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAiAssist = async (mode: ModeTab, q?: string) => {
    if (!chatbotId || !sessionId) return;
    try {
      setLoading(true);
      const res = await fetch("/api/inbox/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          sessionId,
          mode,
          question: q,
        }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      if (mode === "summary") {
        setSummary(data.result);
      } else if (mode === "suggest_reply") {
        setSuggestedReply(data.result);
      } else if (mode === "qa") {
        setAnswer(data.result);
      }
    } catch {
      toast.error(t("aiModerator.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleApply = (text: string) => {
    if (onApplySuggestedReply) {
      onApplySuggestedReply(text);
      toast.success(t("aiModerator.replyInserted"));
    } else {
      handleCopy(text);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            setActiveTab("summary");
            if (!summary) fetchAiAssist("summary");
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
            activeTab === "summary"
              ? "bg-primary/15 text-primary border border-primary/25 shadow-2xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>{t("aiModerator.tabSummary")}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("suggest_reply");
            if (!suggestedReply) fetchAiAssist("suggest_reply");
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
            activeTab === "suggest_reply"
              ? "bg-primary/15 text-primary border border-primary/25 shadow-2xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>{t("aiModerator.tabReply")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qa")}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
            activeTab === "qa"
              ? "bg-primary/15 text-primary border border-primary/25 shadow-2xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HelpCircle className="w-3 h-3" />
          <span>{t("aiModerator.tabQA")}</span>
        </button>
      </div>

      {/* Mode 1: Summary */}
      {activeTab === "summary" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-[11.5px] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>{t("aiModerator.generating")}</span>
            </div>
          ) : summary ? (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-[11.5px] text-foreground leading-relaxed whitespace-pre-wrap">
              {summary}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fetchAiAssist("summary")}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11.5px] font-semibold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t("aiModerator.generateSummary")}</span>
            </button>
          )}
        </div>
      )}

      {/* Mode 2: Suggest Reply */}
      {activeTab === "suggest_reply" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-[11.5px] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>{t("aiModerator.generating")}</span>
            </div>
          ) : suggestedReply ? (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/25 text-[11.5px] text-foreground leading-relaxed">
                <p className="font-medium">{suggestedReply}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApply(suggestedReply)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-95 transition-opacity"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>{t("aiModerator.insertReply")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy(suggestedReply)}
                  className="p-1.5 rounded-xl border border-border hover:bg-muted/50 text-muted-foreground transition-colors"
                  title="Copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fetchAiAssist("suggest_reply")}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11.5px] font-semibold transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t("aiModerator.suggestReplyBtn")}</span>
            </button>
          )}
        </div>
      )}

      {/* Mode 3: Q&A */}
      {activeTab === "qa" && (
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) fetchAiAssist("qa", question);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("aiModerator.qaPlaceholder")}
              className="flex-1 px-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-[11.5px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold disabled:opacity-50 transition-opacity flex items-center gap-1"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </button>
          </form>

          {answer && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-[11.5px] text-foreground leading-relaxed mt-2">
              <p className="font-semibold text-primary text-[10.5px] uppercase tracking-wider mb-1">
                AI Answer
              </p>
              <p>{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
