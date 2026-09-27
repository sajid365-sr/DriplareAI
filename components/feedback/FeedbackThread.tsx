"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { AlertTriangle, Loader2, Send, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { feedbackStatusClass } from "./status-styles";
import type { FeedbackAttachmentView, FeedbackReplyView, FeedbackThreadView } from "./types";

/**
 * A feedback conversation.
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendered by both sides — the merchant's dialog and the admin's detail view —
 * so there is exactly one implementation of "what a thread looks like".
 *
 * `viewer` decides which side is "me" (own messages align right) and therefore
 * whether the reply box is shown; the admin view additionally renders the
 * captured technical context, which the merchant has no reason to re-read.
 */

interface FeedbackThreadProps {
  thread: FeedbackThreadView;
  viewer: "merchant" | "admin";
  onReply: (body: string) => Promise<void>;
  /** Extra controls rendered next to the reply box (e.g. admin status actions). */
  actions?: React.ReactNode;
  /** Shows the auto-captured page/browser/console context. Admin only. */
  showContext?: boolean;
  /** Merchant context, present only in the admin view. */
  merchant?: { name: string; email: string };
}

export function FeedbackThread({
  thread,
  viewer,
  onReply,
  actions,
  showContext = false,
  merchant,
}: FeedbackThreadProps) {
  const { t } = useTranslation("feedback");

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [thread.replies.length]);

  const handleSend = async () => {
    const body = reply.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      await onReply(body);
      setReply("");
    } catch {
      // The caller surfaces the error; keeping the draft means the merchant
      // does not have to retype their reply after a failed send.
    } finally {
      setSending(false);
    }
  };

  const consoleErrors = Array.isArray(thread.consoleErrors) ? thread.consoleErrors : [];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Ticket header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground break-words">{thread.subject}</h3>
          <p className="text-xs text-muted-foreground">
            {format(new Date(thread.createdAt), "dd MMM yyyy, HH:mm")}
            {merchant ? ` · ${merchant.name} (${merchant.email})` : ""}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0", feedbackStatusClass(thread.status))}>
          {t(`status.${thread.status}`, thread.status)}
        </Badge>
      </div>

      {/* ── Captured context (admin) ────────────────────────────────────── */}
      {showContext && <ContextPanel thread={thread} />}

      {/* ── Attachments ─────────────────────────────────────────────────── */}
      {thread.attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("thread.attachments", { count: thread.attachments.length, defaultValue: "Attachments" })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {thread.attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        </div>
      )}

      {/* ── Console errors (admin) ──────────────────────────────────────── */}
      {showContext && consoleErrors.length > 0 && (
        <div className="rounded-lg border border-warning/25 bg-warning/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning mb-1.5">
            <Terminal className="size-3.5" />
            {t("thread.consoleErrors", "Recent console errors")}
          </p>
          <ul className="space-y-1">
            {consoleErrors.map((entry, index) => (
              <li
                key={index}
                className="text-[11px] font-mono text-muted-foreground break-all whitespace-pre-wrap"
              >
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Conversation ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Message
          author={merchant?.name ?? t("thread.you", "You")}
          createdAt={thread.createdAt}
          body={thread.message}
          align={viewer === "merchant" ? "right" : "left"}
        />

        {thread.replies.map((item) => (
          <Message
            key={item.id}
            author={item.authorName}
            createdAt={item.createdAt}
            body={item.body}
            align={item.authorType === viewer ? "right" : "left"}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Reply box ───────────────────────────────────────────────────── */}
      {thread.status !== "closed" && (
        <div className="space-y-2 border-t border-border pt-3">
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            maxLength={5000}
            disabled={sending}
            placeholder={t("thread.replyPlaceholder", "Write a reply…")}
            className="resize-y min-h-16"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={sending || reply.trim().length === 0}
              className="gap-1.5"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("thread.send", "Send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

/** One chat bubble. `align` is resolved from the viewer, not from `authorType`. */
function Message({
  author,
  createdAt,
  body,
  align,
}: {
  author: string;
  createdAt: string;
  body: string;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex", align === "right" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 border",
          align === "right"
            ? "bg-primary/10 border-primary/20 rounded-br-sm"
            : "bg-muted border-border rounded-bl-sm"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px] font-medium text-foreground truncate max-w-[160px]">
            {author}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {format(new Date(createdAt), "dd MMM, HH:mm")}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{body}</p>
      </div>
    </div>
  );
}

/** Renders an attachment with the player or preview that suits its kind. */
function AttachmentCard({ attachment }: { attachment: FeedbackAttachmentView }) {
  const label = attachment.label ?? attachment.fileName ?? attachment.kind;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {attachment.kind === "image" && (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
          {/* Cloudinary already hosts an optimised asset; next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={label}
            loading="lazy"
            className="w-full max-h-72 object-contain bg-muted/40"
          />
        </a>
      )}

      {attachment.kind === "video" && (
        <video src={attachment.url} controls preload="metadata" className="w-full max-h-72 bg-black" />
      )}

      {attachment.kind === "audio" && (
        <div className="p-3">
          <audio src={attachment.url} controls preload="metadata" className="w-full" />
        </div>
      )}

      <div className="px-2.5 py-1.5 border-t border-border flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate" title={label}>
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </div>
    </div>
  );
}

/** The auto-captured environment — the part that makes a report reproducible. */
function ContextPanel({ thread }: { thread: FeedbackThreadView }) {
  const { t } = useTranslation("feedback");
  const context = (thread.clientContext ?? {}) as Record<string, unknown>;

  const rows: [string, string][] = [
    [t("context.page", "Page"), thread.pageUrl ?? "—"],
    [
      t("context.browser", "Browser"),
      [context.browser, context.os].filter(Boolean).join(" · ") || "—",
    ],
    [t("context.viewport", "Viewport"), String(context.viewport ?? "—")],
    [t("context.screen", "Screen"), String(context.screen ?? "—")],
    [t("context.locale", "Locale"), String(context.locale ?? "—")],
    [t("context.theme", "Theme"), String(context.theme ?? "—")],
    [t("context.appVersion", "App version"), String(context.appVersion ?? "—")],
    [t("context.workspace", "Workspace"), thread.workspaceId ?? "—"],
    [t("context.bot", "Bot"), thread.chatbotId ?? "—"],
  ];

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
        <AlertTriangle className="size-3.5 text-primary" />
        {t("context.title", "Captured environment")}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2 min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
              {label}
            </dt>
            <dd className="text-[11px] text-foreground truncate" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Human-readable size for the attachment footer. */
function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
