"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/chat-models";

export default function Compare() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [a, setA] = useState(`${DEFAULT_CHAT_MODEL.provider}|${DEFAULT_CHAT_MODEL.model}`);
  const [b, setB] = useState(
    `${CHAT_MODELS[1]?.provider || DEFAULT_CHAT_MODEL.provider}|${CHAT_MODELS[1]?.model || DEFAULT_CHAT_MODEL.model}`
  );
  const [msg, setMsg] = useState("");
  const [out, setOut] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!msg.trim()) return;
    setBusy(true); setOut({ a: "", b: "" });
    try {
      const [pa, ma] = a.split("|"); const [pb, mb] = b.split("|");
      const r = await fetch(`/api/chatbots/${chatbotId}/compare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, providerA: pa, modelA: ma, providerB: pb, modelB: mb })
      });
      const data = await r.json();
      setOut(data);
    } catch { toast.error("Compare failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Model Comparison</h1>
        <Button className="bg-gradient-to-r from-primary to-fuchsia-500 rounded-full text-white" data-testid="configure-models"><Settings2 className="w-4 h-4 mr-1" /> Configure Models</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { v: a, set: setA, out: out.a, key: "a" },
          { v: b, set: setB, out: out.b, key: "b" },
        ].map((c) => (
          <div key={c.key} className="rounded-2xl border border-border bg-card p-5 min-h-[400px]" data-testid={`compare-panel-${c.key}`}>
            <select value={c.v} onChange={(e) => c.set(e.target.value)} className="text-sm font-mono mb-4 bg-transparent border border-border rounded px-2 py-1" data-testid={`compare-select-${c.key}`}>
              {CHAT_MODELS.map(m => <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}</option>)}
            </select>
            <div className="text-sm whitespace-pre-wrap min-h-[300px] text-foreground">{c.out || (busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-muted-foreground">Response will appear here…</span>)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 h-12 px-4 rounded-full border-2 border-primary/30 focus:border-primary outline-none bg-background" placeholder="Type your message to compare both models…" value={msg} onChange={(e) => setMsg(e.target.value)} data-testid="compare-input" />
        <Button onClick={run} disabled={busy} className="rounded-full px-6 bg-primary/80 hover:bg-primary" data-testid="compare-run">Compare (2 pts)</Button>
      </div>
      <div className="text-xs text-muted-foreground">Each comparison costs 2 points</div>
    </div>
  );
}
