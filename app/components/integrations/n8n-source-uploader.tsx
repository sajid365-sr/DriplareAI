"use client";

import { useState } from "react";
import { Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface N8nSourceUploaderProps {
  chatbotId: string;
  ingestUrl: string;
}

export function N8nSourceUploader({ chatbotId, ingestUrl }: N8nSourceUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !ingestUrl) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chatbotId", chatbotId);

      const response = await fetch(ingestUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload to n8n");

      toast.success("File sent to n8n for processing!");
      setFile(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold">n8n Knowledge Ingest (Test)</h3>
          <p className="text-xs text-muted-foreground">This file will be sent directly to your n8n workflow.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex-1 cursor-pointer">
          <div className="flex items-center justify-center gap-2 p-4 border rounded-xl bg-background hover:bg-muted/50 transition-all border-border border-dashed">
            {file ? (
              <>
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Select any file (PDF, Excel, CSV...)</span>
              </>
            )}
          </div>
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />
        </label>

        <Button 
          disabled={!file || loading} 
          onClick={handleUpload}
          className="rounded-xl px-6"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Send to n8n
        </Button>
      </div>
    </div>
  );
}

import { Send } from "lucide-react";
