"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import { ChatSettings } from "./_components/chat-settings";
import { ChatPreview } from "./_components/chat-preview";

export default function ChatPage() {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");
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

  // Floating Chat Widget Simulator State
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

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
        fetch("/api/usage"),
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

  return (
    <div className="space-y-6 pb-12 relative">
      {/* ─── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {t("chat_test.title", "Chat Playground")}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            {t("chat_test.subtitle", "Configure your chatbot and test responses using the live floating simulator.")}
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold text-white bg-brand-gradient shadow-md shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("chat_test.config.save", "Save Changes")}
        </button>
      </div>

      {/* ─── Full-width Configuration Cards Area (100% Width) ──────── */}
      <div className="w-full space-y-6">
        <ChatSettings
          bot={bot}
          userPlan={userPlan}
          onBotChange={(key, val) => setBot((b: any) => ({ ...b, [key]: val }))}
          onModelSelect={handleModelSelect}
        />
      </div>

      {/* ─── Floating Chat Simulator Launcher & Overlay (Pinned Bottom-Right) ─── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* Floating Tooltip Badge above Launcher (Only when widget is closed) */}
        {!isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={() => setIsWidgetOpen(true)}
            className="bg-card border border-primary/30 text-foreground shadow-lg px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce cursor-pointer select-none"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>⚡ আমাকে টেস্ট করুন!</span>
          </motion.div>
        )}

        {/* Floating Launcher Trigger Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsWidgetOpen((prev) => !prev)}
          className="w-14 h-14 rounded-full bg-brand-gradient text-white shadow-2xl shadow-primary/40 flex items-center justify-center relative group cursor-pointer border-2 border-white/20 ring-4 ring-primary/10"
          title={isWidgetOpen ? "Close Live Chat Simulator" : "Open Live Chat Simulator"}
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
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[580px] max-h-[80vh] z-50 shadow-2xl rounded-3xl overflow-hidden border border-border bg-card"
          >
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
              onClose={() => setIsWidgetOpen(false)}
              messagesEndRef={messagesEndRef}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
