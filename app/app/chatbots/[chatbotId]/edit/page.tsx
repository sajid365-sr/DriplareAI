"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EditBot() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [bot, setBot] = useState<any>(null);
  const router = useRouter();

  useEffect(() => { 
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}`).then(r => r.json()).then(setBot); 
  }, [chatbotId]);

  const save = async () => {
    await fetch(`/api/chatbots/${chatbotId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bot.name })
    });
    toast.success("Saved"); 
    router.push(`/app/chatbots/${chatbotId}/chat`);
  };

  if (!bot) return <Loader2 className="w-5 h-5 animate-spin m-8 text-primary" />;

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Edit Chatbot</h1>
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <div><Label>Name</Label><Input value={bot.name} onChange={(e) => setBot({ ...bot, name: e.target.value })} className="mt-1" data-testid="edit-name" /></div>
        <Button onClick={save} className="rounded-full" data-testid="edit-save">Save</Button>
      </div>
    </div>
  );
}
