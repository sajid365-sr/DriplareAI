"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";

export default function BotSettings() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [bot, setBot] = useState<any>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const router = useRouter();
  const confirm = useConfirm((state) => state.confirm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}`).then(r => r.json()).then(data => {
      setBot(data);
      if (data.avatarBase64) setAvatarBase64(data.avatarBase64);
    }); 
  }, [chatbotId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/webp", 0.8);
        setAvatarBase64(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const del = async () => {
    confirm(
      "Delete Chatbot",
      `Are you sure you want to delete "${bot?.name}"? This will permanently remove all messages, training data, and integrations associated with this bot.`,
      async () => {
        await fetch(`/api/chatbots/${chatbotId}`, { method: "DELETE" });
        toast.success("Chatbot deleted permanently"); 
        router.push("/dashboard/chatbots");
      }
    );
  };

  const save = async () => { 
    await fetch(`/api/chatbots/${chatbotId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bot.name, avatarBase64 })
    }); 
    toast.success("Chatbot settings updated successfully"); 
  };

  if (!bot) return <Loader2 className="w-5 h-5 animate-spin m-8 text-primary" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Chatbot Settings</h1>
      <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
        <div>
          <Label className="mb-3 block">Bot Avatar</Label>
          <div className="flex items-center gap-4">
            <div 
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 border-[3px] border-background shadow-md flex items-center justify-center cursor-pointer overflow-hidden group shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarBase64 ? (
                <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-3xl font-semibold text-white">{bot.name?.[0]?.toUpperCase()}</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px]">
                <Camera className="w-5 h-5" />
              </div>
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Change Picture</Button>
              <p className="text-[11px] text-muted-foreground mt-2">Recommended: 256x256px. Max: 5MB.</p>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          </div>
        </div>
        <div className="h-px bg-border w-full" />
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
