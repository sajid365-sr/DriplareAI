"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Save, Loader2, SlidersHorizontal, MessageSquare } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { ChatSettings } from "./_components/chat-settings";
import { ChatPreview } from "./_components/chat-preview";

type MobileView = "configure" | "test";

export default function ChatPage() {
  const { chatbotId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- State ---
  const [bot, setBot] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Mobile/tablet: which panel is visible (desktop shows both side-by-side).
  const [mobileView, setMobileView] = useState<MobileView>("configure");

  // --- Effects ---
  useEffect(() => {
    if (chatbotId) fetchBot();
  }, [chatbotId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // --- Helpers ---
  const fetchBot = async () => {
    try {
      const [botRes, usageRes] = await Promise.all([
        fetch(`/api/chatbots/${chatbotId}`),
        fetch("/api/usage")
      ]);
      const botData = await botRes.json();
      const usageData = await usageRes.json();

      setBot(botData);
      if (usageData && usageData.plan) {
        setUserPlan(usageData.plan);
      }
    } catch (err) {
      toast.error("Failed to load bot settings");
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = (key: string) => {
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
          // Dual-prompt assembly: send the human-readable raw prompt plus the
          // compiled production prompt so both persist correctly in the DB.
          rawPrompt: bot.rawPrompt ?? bot.systemPrompt,
          compiledPrompt: bot.compiledPrompt,
          promptMode: bot.promptMode,
          wizardData: bot.wizardData,
          name: bot.name,
          chatbotMode: bot.chatbotMode,
        })
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } catch {
      toast.error("An error occurred while saving");
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

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const currentSessionId = ensureSessionId();
    const text = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: currentSessionId })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        toast.error(data.error || "Failed to get response");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!bot) return <div className="p-8 text-center text-rose-500">Bot not found</div>;

  const mobileTabs: Array<{ key: MobileView; label: string; icon: typeof SlidersHorizontal }> = [
    { key: "configure", label: "Configure", icon: SlidersHorizontal },
    { key: "test", label: "Test Chat", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Chat Playground</h1>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            Configure and test your chatbot in real-time.
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold text-white bg-brand-gradient shadow-md shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* ─── Mobile / tablet panel toggle (< lg) ────────────────────────── */}
      <div className="lg:hidden">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-secondary/50 border border-border/50">
          {mobileTabs.map((t) => {
            const active = mobileView === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setMobileView(t.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all",
                  active
                    ? "bg-brand-gradient text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Configuration */}
        <div
          className={cn(
            "lg:col-span-7 xl:col-span-8 space-y-6",
            mobileView === "configure" ? "block" : "hidden lg:block"
          )}
        >
          <ChatSettings
            bot={bot}
            userPlan={userPlan}
            onBotChange={(key, val) => setBot((b: any) => ({ ...b, [key]: val }))}
            onModelSelect={handleModelSelect}
          />
        </div>

        {/* Right: Live preview (sticky on desktop) */}
        <div
          className={cn(
            "lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 h-[600px] lg:h-[calc(100vh-7rem)]",
            mobileView === "test" ? "block" : "hidden lg:block"
          )}
        >
          <ChatPreview
            messages={messages}
            input={input}
            sending={sending}
            onInputChange={setInput}
            onSend={sendMessage}
            onReset={() => { setMessages([]); setSessionId(null); }}
            messagesEndRef={messagesEndRef}
          />
        </div>
      </div>
    </div>
  );
}
