"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace-provider";
import { resolveAttachmentKind } from "@/lib/domain/feedback-constants";
import { getRecentConsoleErrors, clearConsoleErrors } from "@/lib/feedback/console-capture";
import { collectClientContext, currentPagePath } from "@/lib/feedback/context";
import { uploadFeedbackAttachment, type UploadedAttachment } from "@/lib/feedback/upload";
import { FeedbackAttachmentPicker } from "./FeedbackAttachmentPicker";
import { ScreenshotAnnotator } from "./ScreenshotAnnotator";
import type { StagedAttachment } from "./types";

/**
 * New-feedback form.
 * ─────────────────────────────────────────────────────────────────────────────
 * Collects the merchant's report and the technical context an admin needs to
 * reproduce it, then uploads the attachments and posts the ticket.
 *
 * Uploads happen at submit time, not on pick — so a merchant who changes their
 * mind leaves nothing behind in Cloudinary, and every file has one clear
 * progress bar the merchant can watch.
 */

interface FeedbackComposerProps {
  /** Captured before the dialog opened; `null` when capture was not possible. */
  autoScreenshot: File | null;
  /** Set when the merchant opened feedback from a bot page. */
  chatbotId?: string | null;
  onSubmitted: (feedbackId: string) => void;
}

export function FeedbackComposer({
  autoScreenshot,
  chatbotId,
  onSubmitted,
}: FeedbackComposerProps) {
  const { t } = useTranslation("feedback");
  const { activeWorkspaceId } = useWorkspace();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Context is snapshotted when the form mounts. Reading it during render would
   * re-read `navigator` on every keystroke, and reading it at submit time would
   * describe the dialog rather than the page the merchant was looking at.
   */
  const context = useMemo(() => collectClientContext(), []);
  const pageUrl = useMemo(() => currentPagePath(), []);

  // ── Seed the auto screenshot ──────────────────────────────────────────────
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !autoScreenshot) return;
    seededRef.current = true;
    setAttachments([stageFile(autoScreenshot, t("picker.autoScreenshot", "Auto screenshot"))]);
  }, [autoScreenshot, t]);

  /**
   * Preview URLs hold the whole file in memory until revoked. Closing the
   * dialog without submitting must release them, or a discarded 25 MB video
   * stays alive for the rest of the session.
   */
  const attachmentsRef = useRef<StagedAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    },
    []
  );

  // ── Attachment handling ───────────────────────────────────────────────────
  const handleAdd = useCallback((files: File[]) => {
    setAttachments((prev) => [...prev, ...files.map((file) => stageFile(file, file.name))]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /** Replaces an image with its annotated version, keeping its position. */
  const handleAnnotated = useCallback((id: string, file: File) => {
    setAttachments((prev) =>
      prev.map((attachment) => {
        if (attachment.id !== id) return attachment;
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
        return stageFile(file, attachment.label);
      })
    );
    setAnnotatingId(null);
  }, []);

  const annotating = attachments.find((a) => a.id === annotatingId) ?? null;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (subject.trim().length < 3) {
      toast.error(t("composer.errors.subject", "Please add a short subject."));
      return;
    }

    if (message.trim().length < 10) {
      toast.error(
        t("composer.errors.message", "Please describe the issue in a little more detail.")
      );
      return;
    }

    setSubmitting(true);

    try {
      // The label is carried alongside the upload result so the server stores
      // what the merchant saw ("Auto screenshot") rather than a temp filename.
      const uploaded: (UploadedAttachment & { label: string })[] = [];

      // Sequential, not parallel: progress stays readable and we avoid opening
      // five simultaneous uploads on a slow connection.
      for (const attachment of attachments) {
        setAttachments((prev) =>
          prev.map((a) => (a.id === attachment.id ? { ...a, status: "uploading", progress: 0 } : a))
        );

        try {
          const result = await uploadFeedbackAttachment(attachment.file, (progress) => {
            setAttachments((prev) =>
              prev.map((a) => (a.id === attachment.id ? { ...a, progress } : a))
            );
          });

          uploaded.push({ ...result, label: attachment.label });
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachment.id ? { ...a, status: "done", progress: 100 } : a))
          );
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Upload failed";
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachment.id ? { ...a, status: "error", error: reason } : a))
          );
          // Stop before creating a ticket that is missing half its evidence.
          throw new Error(`${attachment.label}: ${reason}`);
        }
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          workspaceId: activeWorkspaceId ?? undefined,
          chatbotId: chatbotId ?? undefined,
          pageUrl,
          userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 500),
          clientContext: context,
          consoleErrors: getRecentConsoleErrors(),
          attachments: uploaded.map((file) => ({
            kind: file.kind,
            url: file.url,
            publicId: file.publicId,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            fileName: file.fileName,
            label: file.label,
          })),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not send your feedback.");
      }

      toast.success(
        t("composer.success", "Thank you — your feedback has been sent to our team.")
      );

      // The console buffer has now been handed over; start a fresh window so
      // the next report describes the next problem, not this one.
      clearConsoleErrors();

      setSubject("");
      setMessage("");
      setAttachments((prev) => {
        prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        return [];
      });

      onSubmitted(payload.id as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const contextRows: [string, string][] = [
    [t("composer.context.page", "Page"), pageUrl || "—"],
    [t("composer.context.browser", "Browser"), `${context.browser} · ${context.os}`],
    [t("composer.context.viewport", "Viewport"), `${context.viewport} · ${context.theme}`],
    [t("composer.context.workspace", "Workspace"), activeWorkspaceId ?? "—"],
    ...(chatbotId ? ([[t("composer.context.bot", "Bot"), chatbotId]] as [string, string][]) : []),
  ];

  const consoleErrors = getRecentConsoleErrors();

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="feedback-subject">{t("composer.subject", "Subject")}</Label>
          <Input
            id="feedback-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t("composer.subjectPlaceholder", "Short summary of the problem")}
            maxLength={160}
            disabled={submitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-message">{t("composer.message", "What happened?")}</Label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t(
              "composer.messagePlaceholder",
              "Describe what you expected and what happened instead. Steps to reproduce help a lot."
            )}
            rows={5}
            maxLength={5000}
            disabled={submitting}
            className="resize-y min-h-24"
          />
        </div>

        <FeedbackAttachmentPicker
          attachments={attachments}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onAnnotate={setAnnotatingId}
          disabled={submitting}
        />

        {/* ── Auto-captured context ─────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={showDetails}
          >
            <Info className="size-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground flex-1">
              {t("composer.context.title", "We attach this automatically to help us fix it faster")}
            </span>
            <span className="text-xs text-muted-foreground">
              {showDetails ? t("common.hide", "Hide") : t("common.show", "Show")}
            </span>
          </button>

          {showDetails && (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {contextRows.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2 min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
                    {label}
                  </dt>
                  <dd className="text-xs text-foreground truncate" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {consoleErrors.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="size-3 text-warning" />
              {t("composer.context.errors", {
                count: consoleErrors.length,
                defaultValue: `${consoleErrors.length} recent console error(s) will be included.`,
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting
              ? t("composer.sending", "Sending…")
              : t("composer.submit", "Send feedback")}
          </Button>
        </div>
      </form>

      <ScreenshotAnnotator
        file={annotating?.file ?? null}
        open={!!annotating}
        onCancel={() => setAnnotatingId(null)}
        onSave={(file) => annotating && handleAnnotated(annotating.id, file)}
      />
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wraps a `File` in the extra client-side state the picker renders. */
function stageFile(file: File, label: string): StagedAttachment {
  const kind = resolveAttachmentKind(file.type) ?? "image";

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    kind,
    // Audio has no visual preview; images and videos do.
    previewUrl: kind === "audio" ? null : URL.createObjectURL(file),
    label,
    status: "staged",
    progress: 0,
  };
}
