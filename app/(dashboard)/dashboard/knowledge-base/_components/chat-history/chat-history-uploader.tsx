"use client";

import { useRef, useState } from "react";
import { Upload, MessageSquare, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChatHistoryUploaderProps {
  chatbotId: string;
  onSuccess: () => void;
}

export function ChatHistoryUploader({ chatbotId, onSuccess }: ChatHistoryUploaderProps) {
  const [chatHistoryFiles, setChatHistoryFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const chatHistoryInputRef = useRef<HTMLInputElement>(null);

  const handleChatHistoryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    setChatHistoryFiles((prev) => [...prev, ...incoming]);
    e.target.value = "";
  };

  const removeChatHistoryFile = (index: number) => {
    setChatHistoryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadChatHistory = async () => {
    if (chatHistoryFiles.length === 0) return;
    setBusy(true);
    let successCount = 0;

    for (const file of chatHistoryFiles) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sources/chat-history`, {
          method: "POST",
          body: formData,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body.error || `Upload failed: ${file.name}`);
        } else {
          toast.success(
            `"${file.name}" থেকে ${body.pairsIngested ?? 0}টি কথোপকথন শেখানো হয়েছে!`
          );
          successCount++;
        }
      } catch {
        toast.error(`Upload failed for ${file.name}`);
      }
    }

    if (successCount > 0) {
      onSuccess();
      setChatHistoryFiles([]);
      if (chatHistoryInputRef.current) chatHistoryInputRef.current.value = "";
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
        <Upload className="w-8 h-8 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
        <div className="font-semibold text-center text-sm">CSV বা JSON ফাইল আপলোড করুন</div>
        <div className="text-[11px] text-muted-foreground mt-1.5 bg-secondary/50 px-4 py-1.5 rounded-full border border-border/40">
          Supported: .csv, .json (Facebook export)
        </div>
        <input
          ref={chatHistoryInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChatHistoryFiles}
          accept=".csv,.json"
        />
      </label>

      {chatHistoryFiles.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">নির্বাচিত ফাইলসমূহ</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {chatHistoryFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium truncate">{file.name}</span>
                </div>
                <button onClick={() => removeChatHistoryFile(idx)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={uploadChatHistory} disabled={busy} className="rounded-full">
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                AI-কে ট্রেন করুন
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
