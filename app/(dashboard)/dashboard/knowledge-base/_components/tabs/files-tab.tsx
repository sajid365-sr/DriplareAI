"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FilesTabProps {
  chatbotId: string;
  onSuccess: () => void;
}

const ACCEPTED = ".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.html,.htm";

export function FilesTab({ chatbotId, onSuccess }: FilesTabProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    e.target.value = "";
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    const uploaded: string[] = [];
    const failed: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sources/file`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          failed.push(file.name);
          toast.error(err.error || `Upload failed: ${file.name}`);
          continue;
        }

        const body = await res.json().catch(() => ({}));
        if (body?.errorMessage) {
          failed.push(file.name);
          toast.error(`Processing failed for ${file.name}: ${body.errorMessage}`);
          continue;
        }

        uploaded.push(file.name);
      } catch {
        failed.push(file.name);
        toast.error(`Upload failed: ${file.name}`);
      }
    }

    if (uploaded.length > 0) {
      toast.success(`${uploaded.length} file(s) uploaded successfully`);
      onSuccess();
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      {/* Drop zone */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-16 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
        <Upload className="w-10 h-10 text-muted-foreground mb-4 group-hover:text-primary transition-colors" />
        <div className="font-semibold text-center">
          Drag &amp; drop files here, or click to select files
        </div>
        <div className="text-[11px] text-muted-foreground mt-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border/40">
          Supported: .pdf, .docx, .doc, .xlsx, .xls, .csv, .txt, .html, .htm
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
          accept={ACCEPTED}
        />
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Attached Files
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 group"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{file.name}</span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={upload} disabled={busy} className="rounded-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload selected files"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
