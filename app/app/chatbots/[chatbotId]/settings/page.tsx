"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";

export default function BotSettings() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [bot, setBot] = useState<any>(null);
  const router = useRouter();
  const confirm = useConfirm((state) => state.confirm);

  useEffect(() => { 
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}`).then(r => r.json()).then(setBot); 
  }, [chatbotId]);

  const del = async () => {
    confirm(
      "Delete Chatbot",
      `Are you sure you want to delete "${bot?.name}"? This will permanently remove all messages, training data, and integrations associated with this bot.`,
      async () => {
        await fetch(`/api/chatbots/${chatbotId}`, { method: "DELETE" });
        toast.success("Chatbot deleted permanently"); 
        router.push("/app/chatbots");
      }
    );
  };

  const save = async () => { 
    await fetch(`/api/chatbots/${chatbotId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bot.name })
    }); 
    toast.success("Chatbot settings updated successfully"); 
  };

  if (!bot) return <Loader2 className="w-5 h-5 animate-spin m-8 text-primary" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Chatbot Settings</h1>
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <div><Label>Name</Label><Input value={bot.name} onChange={(e) => setBot({ ...bot, name: e.target.value })} className="mt-1" data-testid="bs-name" /></div>
        <div><Label>Chatbot ID</Label><Input value={chatbotId} disabled className="mt-1 font-mono text-xs" /></div>
        <Button onClick={save} className="rounded-full" data-testid="bs-save">Save</Button>
      </div>
      <div className="p-6 rounded-2xl border border-destructive/30 bg-destructive/5">
        <div className="font-semibold text-destructive mb-2">Danger zone</div>
        <Button variant="destructive" onClick={del} className="rounded-full" data-testid="bs-delete"><Trash2 className="w-4 h-4 mr-1" /> Delete chatbot</Button>
      </div>
    </div>
  );
}
