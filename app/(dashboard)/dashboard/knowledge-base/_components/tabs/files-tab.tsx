"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface FilesTabProps {
  chatbotId?: string;
  workspaceId?: string;
  retrySourceId?: string;
  onSuccess: () => void;
  onRetrySourceHandled?: () => void;
}

type PendingUpload = {
  file: File;
  sourceId?: string;
};

const ACCEPTED = ".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.html,.htm";

export function FilesTab({ chatbotId, workspaceId, retrySourceId, onSuccess, onRetrySourceHandled }: FilesTabProps) {
  const { t } = useTranslation("knowledge-base");
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (retrySourceId) fileInputRef.current?.click();
  }, [retrySourceId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [
      ...prev,
      ...selectedFiles.map((file, index) => ({
        file,
        ...(index === 0 && retrySourceId ? { sourceId: retrySourceId } : {}),
      })),
    ]);
    if (retrySourceId) onRetrySourceHandled?.();
    e.target.value = "";
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    let uploadedCount = 0;
    const remaining: PendingUpload[] = [];

    for (const pending of files) {
      const { file } = pending;
      const formData = new FormData();
      formData.append("file", file);
      if (pending.sourceId) formData.append("sourceId", pending.sourceId);

      try {
        const res = await fetch(workspaceId ? `/api/workspaces/${workspaceId}/sources` : `/api/chatbots/${chatbotId}/sources/file`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err: unknown = await res.json().catch(() => ({ error: "Upload failed" }));
          const retrySourceId = err && typeof err === "object" && "sourceId" in err && typeof err.sourceId === "string"
            ? err.sourceId
            : pending.sourceId;
          remaining.push({ file, ...(retrySourceId ? { sourceId: retrySourceId } : {}) });
          const errorCode = err && typeof err === "object" && "code" in err ? err.code : null;
          if (errorCode === "N8N_INGEST_TEST_WEBHOOK_NOT_LISTENING") {
            toast.error(t("contentTraining.fileUploadTestWebhookError"));
          } else if (errorCode === "N8N_INGEST_PRODUCTION_WEBHOOK_NOT_ACTIVE") {
            toast.error(t("contentTraining.fileUploadInactiveWebhookError"));
          } else {
            const message = err && typeof err === "object" && "error" in err && typeof err.error === "string"
              ? err.error
              : `Upload failed: ${file.name}`;
            toast.error(message);
          }
          continue;
        }

        const body = await res.json().catch(() => ({}));
        if (body?.errorMessage) {
          const retrySourceId = typeof body.sourceId === "string" ? body.sourceId : pending.sourceId;
          remaining.push({ file, ...(retrySourceId ? { sourceId: retrySourceId } : {}) });
          toast.error(`Processing failed for ${file.name}: ${body.errorMessage}`);
          continue;
        }

        uploadedCount += 1;
      } catch {
        remaining.push(pending);
        toast.error(`Upload failed: ${file.name}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} file(s) uploaded successfully`);
    }

    setFiles(remaining);
    onSuccess();
    if (remaining.length === 0 && fileInputRef.current) fileInputRef.current.value = "";
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
          multiple={!retrySourceId}
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
                key={`${file.file.name}-${index}`}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 group"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{file.file.name}</span>
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
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : files.some((pending) => pending.sourceId)
              ? t("contentTraining.fileRetryUpload", "Retry failed uploads")
              : t("contentTraining.fileUploadSelected", "Upload selected files")}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
