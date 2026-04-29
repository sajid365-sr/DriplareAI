"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Loader2, Database, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { CHAT_MODELS } from "@/lib/chat-models";

export default function ChatPlayground() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [bot, setBot] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createSessionId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}`;
  };

  const ensureSessionId = () => {
    const key = `driplare-chat-session:${chatbotId}`;
    if (sessionId) {
      return sessionId;
    }

    const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    const nextSessionId = existing || createSessionId();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, nextSessionId);
    }

    setSessionId(nextSessionId);
    return nextSessionId;
  };

  const load = async () => {
    if (!chatbotId) return;
    const r = await fetch(`/api/chatbots/${chatbotId}`);
    const data = await r.json();
    setBot(data);
  };
  useEffect(() => { load(); }, [chatbotId]);

  useEffect(() => {
    if (!chatbotId || typeof window === "undefined") return;
    const key = `driplare-chat-session:${chatbotId}`;
    const existing = window.localStorage.getItem(key);
    const nextSessionId = existing || createSessionId();
    if (!existing) {
      window.localStorage.setItem(key, nextSessionId);
    }
    setSessionId(nextSessionId);
  }, [chatbotId]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const update = (k: string, v: any) => setBot((b: any) => ({ ...b, [k]: v }));
  const setModel = (key: string) => {
    const [provider, model] = key.split("|");
    setBot((b: any) => ({ ...b, provider, model }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: bot.model, provider: bot.provider, temperature: bot.temperature, maxTokens: bot.maxTokens, systemPrompt: bot.systemPrompt, name: bot.name,
        })
      });
      if (res.ok) toast.success("Saved");
      else toast.error("Save failed");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const currentSessionId = ensureSessionId();
    const text = input; setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: currentSessionId })
      });
      const data = await r.json();
      if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        toast.error(data.error || "Chat failed");
      }
    } catch { toast.error("Chat failed"); }
    finally { setSending(false); }
  };

  if (!bot) return <div className="p-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>;
  const modelKey = `${bot.provider}|${bot.model}`;
  const modelLabel = CHAT_MODELS.find(m => m.provider === bot.provider && m.model === bot.model)?.label || bot.model;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Model: <span className="font-mono font-medium text-foreground">{modelLabel}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-primary" data-testid="show-source-files"><Database className="w-3.5 h-3.5 mr-1" /> Show Source Files</Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => {
              const nextSessionId = createSessionId();
              if (typeof window !== "undefined") {
                window.localStorage.setItem(`driplare-chat-session:${chatbotId}`, nextSessionId);
              }
              setSessionId(nextSessionId);
              setMessages([]);
            }}
            data-testid="reset-chat"
          ><RefreshCcw className="w-3.5 h-3.5 mr-1" /> Reset</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Config Panel */}
        <div className="space-y-4 p-6 bg-card rounded-2xl border border-border">
          <div>
            <label className="text-sm font-medium">Model</label>
            <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-mono" value={modelKey} onChange={(e) => setModel(e.target.value)} data-testid="chat-model-select">
              {CHAT_MODELS.map((m) => <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm font-medium"><span>Temperature</span><span className="font-mono text-muted-foreground">{bot.temperature?.toFixed(1)}</span></div>
            <Slider min={0} max={1} step={0.1} value={[bot.temperature]} onValueChange={([v]) => update("temperature", v)} className="mt-2" data-testid="slider-temperature" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm font-medium"><span>Max tokens</span><span className="font-mono text-muted-foreground">{bot.maxTokens}</span></div>
            <Slider min={100} max={4096} step={100} value={[bot.maxTokens]} onValueChange={([v]) => update("maxTokens", v)} className="mt-2" data-testid="slider-tokens" />
          </div>
          <div>
            <label className="text-sm font-medium">Instructions for this Chatbot</label>
            <Textarea rows={6} className="mt-1" value={bot.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} data-testid="system-prompt" />
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Agent Status</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Trained</span>
          </div>
          <Button className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-md" onClick={save} disabled={saving} data-testid="save-config-btn">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        {/* Phone preview */}
        <div className="flex justify-center">
          <div className="w-full max-w-[360px] h-[600px] bg-background rounded-[2rem] border-[6px] border-muted shadow-2xl flex flex-col overflow-hidden" data-testid="phone-frame">
            <div className="px-4 py-3 bg-card border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center font-semibold">{bot.name?.[0]?.toUpperCase()}</div>
              <div className="font-semibold">{bot.name}</div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/20 scrollbar-thin">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>{m.content}</div>
                </motion.div>
              ))}
              {sending && <div className="flex"><div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-card border border-border text-sm"><Loader2 className="w-3.5 h-3.5 animate-spin inline" /></div></div>}
            </div>
            <div className="p-3 border-t border-border flex gap-2 items-center">
              <input className="flex-1 h-10 rounded-full border border-input bg-background px-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} data-testid="chat-input" />
              <button className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center" onClick={send} disabled={sending} data-testid="chat-send"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
