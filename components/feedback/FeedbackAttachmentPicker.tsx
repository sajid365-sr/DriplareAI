"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileAudio, FileVideo, Loader2, Paperclip, Pencil, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  resolveAttachmentKind,
} from "@/lib/domain/feedback-constants";
import type { StagedAttachment } from "./types";

/**
 * Attachment picker for feedback.
 * ─────────────────────────────────────────────────────────────────────────────
 * Two jobs: accept files from a click or a drop, and reject the ones the server
 * would reject anyway — before the merchant spends time uploading a 40 MB video
 * that will bounce. The server re-validates everything; these checks exist to
 * give a fast, specific error.
 */

interface FeedbackAttachmentPickerProps {
  attachments: StagedAttachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onAnnotate: (id: string) => void;
  /** Disabled while the form is being submitted. */
  disabled?: boolean;
}

export function FeedbackAttachmentPicker({
  attachments,
  onAdd,
  onRemove,
  onAnnotate,
  disabled = false,
}: FeedbackAttachmentPickerProps) {
  const { t } = useTranslation("feedback");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const remaining = MAX_ATTACHMENTS - attachments.length;
  const maxMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

  /** Validates a batch and forwards only what can actually be uploaded. */
  const accept = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const incoming = Array.from(fileList);
    const accepted: File[] = [];

    for (const file of incoming) {
      if (accepted.length >= remaining) {
        toast.error(
          t("picker.errors.tooMany", {
            count: MAX_ATTACHMENTS,
            defaultValue: `You can attach at most ${MAX_ATTACHMENTS} files.`,
          })
        );
        break;
      }

      if (!resolveAttachmentKind(file.type)) {
        toast.error(
          t("picker.errors.unsupported", {
            name: file.name,
            defaultValue: `${file.name} is not a supported image, audio or video file.`,
          })
        );
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          t("picker.errors.tooLarge", {
            name: file.name,
            size: maxMb,
            defaultValue: `${file.name} is larger than ${maxMb} MB.`,
          })
        );
        continue;
      }

      accepted.push(file);
    }

    if (accepted.length) onAdd(accepted);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files);
          // Reset so picking the same file twice still fires a change event.
          event.target.value = "";
        }}
      />

      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && remaining > 0) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (disabled || remaining <= 0) return;
          accept(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed border-border p-3 sm:p-4 transition-colors",
          dragActive && "border-primary bg-primary/5",
          disabled && "opacity-60"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Paperclip className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("picker.title", "Screenshot, audio or video")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("picker.hint", {
                  count: MAX_ATTACHMENTS,
                  size: maxMb,
                  defaultValue: `Up to ${MAX_ATTACHMENTS} files, ${maxMb} MB each.`,
                })}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || remaining <= 0}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 gap-1.5"
          >
            <UploadCloud className="size-4" />
            {t("picker.choose", "Choose files")}
          </Button>
        </div>
      </div>

      {/* ── Staged previews ─────────────────────────────────────────────── */}
      {attachments.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="relative group rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                <AttachmentPreview attachment={attachment} />
              </div>

              {/* Progress / error strip */}
              {attachment.status === "uploading" && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${attachment.progress}%` }}
                  />
                </div>
              )}

              <div className="p-2">
                <p className="text-[11px] text-muted-foreground truncate">{attachment.label}</p>
              </div>

              {!disabled && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {attachment.kind === "image" && (
                    <button
                      type="button"
                      onClick={() => onAnnotate(attachment.id)}
                      aria-label={t("picker.annotate", "Mark the problem")}
                      title={t("picker.annotate", "Mark the problem")}
                      className="size-7 rounded-md bg-background/90 backdrop-blur flex items-center justify-center text-foreground hover:bg-background shadow-sm"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(attachment.id)}
                    aria-label={t("picker.remove", "Remove")}
                    title={t("picker.remove", "Remove")}
                    className="size-7 rounded-md bg-background/90 backdrop-blur flex items-center justify-center text-destructive hover:bg-background shadow-sm"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders the right inline preview for each attachment kind. */
function AttachmentPreview({ attachment }: { attachment: StagedAttachment }) {
  if (attachment.status === "uploading") {
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  }

  if (attachment.kind === "image" && attachment.previewUrl) {
    // Object URLs are local and short-lived, so next/image would only add indirection.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={attachment.previewUrl}
        alt={attachment.label}
        className="w-full h-full object-cover"
      />
    );
  }

  const Icon = attachment.kind === "audio" ? FileAudio : FileVideo;

  return (
    <div className="flex flex-col items-center gap-1 text-muted-foreground">
      <Icon className="size-5" />
    </div>
  );
}
