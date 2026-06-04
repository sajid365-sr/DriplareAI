"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ChatSettings } from "./_components/chat-settings";
import { ChatPreview } from "./_components/chat-preview";

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
          maxTokens: bot.maxTokens,
          systemPrompt: bot.systemPrompt,
          name: bot.name,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Chat Playground</h1>
        <p className="text-muted-foreground text-sm">Configure and test your chatbot in real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Configuration */}
        <div className="lg:col-span-2">
          <ChatSettings 
            bot={bot}
            userPlan={userPlan}
            saving={saving}
            onBotChange={(key, val) => setBot((b: any) => ({ ...b, [key]: val }))}
            onModelSelect={handleModelSelect}
            onSave={saveSettings}
          />
        </div>

        {/* Right: Preview - sticky */}
        <div className="sticky top-20 self-start">
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
