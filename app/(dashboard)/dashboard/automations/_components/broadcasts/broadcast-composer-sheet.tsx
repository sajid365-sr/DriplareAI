"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import { TEMPLATE_VARIABLE_TOKENS } from "../templates/types";
import { AudienceEditor } from "./audience-editor";
import {
  BROADCAST_PLATFORMS,
  audienceFilterCount,
  emptyAudience,
  requiresTemplate,
  type Broadcast,
  type BroadcastAudience,
} from "./types";

/**
 * Compose a broadcast: who, on what, and what it says.
 *
 * The audience preview is not decoration. A broadcast is the only action in the
 * product that reaches every matching contact at once and cannot be recalled,
 * so the count is fetched before the send button becomes usable — a merchant
 * who has to wait for "142 contacts" to appear has necessarily read it.
 *
 * The send itself is a second call after the save, because creating the record
 * and delivering the messages are deliberately separate on the server. Chaining
 * them here means "Save & send" works in one press while the draft is still
 * real: if the send fails, the broadcast exists and can be retried.
 */

const PREVIEW_DEBOUNCE_MS = 400;

interface ComposerState {
  name: string;
  chatbotId: string;
  channel: string;
  templateId: string;
  body: string;
  audience: BroadcastAudience;
  scheduledAt: string;
}

export function BroadcastComposerSheet({
  open,
  broadcast,
  agents,
  tags,
  templates,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** `null` = composing a new one. */
  broadcast: Broadcast | null;
  agents: { id: string; name: string }[];
  tags: { tagId: string; name: string }[];
  templates: { templateId: string; name: string; waStatus: string }[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("automations");

  const [draft, setDraft] = useState<ComposerState>(() => initialState(broadcast));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [preview, setPreview] = useState<{ reachable: number; unreachable: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // ── Audience preview ──────────────────────────────────────────────────────
  const loadPreview = useCallback(
    async (signal?: AbortSignal) => {
      setPreviewing(true);
      try {
        const response = await fetch("/api/automations/broadcasts/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatbotId: draft.chatbotId || null,
            audience: draft.audience,
            preview: true,
            sampleSize: 1,
          }),
          signal,
        });
        const data = await response.json();
        if (!response.ok) return;
        setPreview({ reachable: data.reachable ?? 0, unreachable: data.unreachable ?? 0 });
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
      } finally {
        setPreviewing(false);
      }
    },
    [draft.chatbotId, draft.audience]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadPreview(controller.signal), PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadPreview]);

  const selectedTemplate = templates.find((entry) => entry.templateId === draft.templateId) ?? null;
  const needsTemplate = requiresTemplate(draft.channel);
  const templateApproved = selectedTemplate?.waStatus === "approved";

  // ── Save ──────────────────────────────────────────────────────────────────
  function payload(next: ComposerState) {
    return {
      name: next.name.trim(),
      chatbotId: next.chatbotId || null,
      channel: next.channel,
      templateId: next.templateId || null,
      body: next.body.trim(),
      audience: next.audience,
      // A `datetime-local` value has no timezone, so `new Date` reads it as
      // local time — which is what the merchant meant. Sending it through
      // `toISOString` is what the API's zod refinement expects.
      scheduledAt: next.scheduledAt ? new Date(next.scheduledAt).toISOString() : null,
    };
  }

  async function persist(next: ComposerState): Promise<string | null> {
    const response = await fetch(
      broadcast ? `/api/automations/broadcasts/${broadcast.broadcastId}` : "/api/automations/broadcasts",
      {
        method: broadcast ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(next)),
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setProblem(data?.error ?? t("broadcasts.saveFailed", "Could not save the broadcast."));
      return null;
    }
    return data?.broadcastId ?? broadcast?.broadcastId ?? null;
  }

  function findProblem(next: ComposerState) {
    if (!next.name.trim()) return t("broadcasts.nameRequired", "Give the broadcast a name.");
    if (!next.body.trim()) return t("broadcasts.bodyRequired", "There is no message to send.");
    if (needsTemplate && !next.templateId) {
      return t(
        "broadcasts.templateRequired",
        "WhatsApp needs an approved template for this — pick one below."
      );
    }
    return null;
  }

  async function save() {
    const failure = findProblem(draft);
    if (failure) {
      setProblem(failure);
      return;
    }

    setSaving(true);
    setProblem(null);
    try {
      const id = await persist(draft);
      if (!id) return;
      onSaved();
    } catch {
      setProblem(t("broadcasts.saveFailed", "Could not save the broadcast."));
    } finally {
      setSaving(false);
    }
  }

  /** Save first, then send — so a failed send still leaves a retryable draft. */
  async function saveAndSend() {
    const failure = findProblem(draft);
    if (failure) {
      setProblem(failure);
      setConfirming(false);
      return;
    }

    setSaving(true);
    setProblem(null);
    try {
      const id = await persist(draft);
      if (!id) return;

      const response = await fetch(`/api/automations/broadcasts/${id}/send`, { method: "POST" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.hint ?? data?.error ?? t("broadcasts.sendFailed", "Could not send."));
        // The record exists now, so the list has to be told even though the
        // send failed — otherwise the new draft is invisible until a refresh.
        onSaved();
        return;
      }

      if (data?.warning) toast.warning(data.warning);
      toast.success(
        t("broadcasts.sendResult", "Queued {{targeted}}, sent {{sent}}, failed {{failed}}", {
          targeted: data?.targeted ?? 0,
          sent: data?.sent ?? 0,
          failed: data?.failed ?? 0,
        })
      );
      onSaved();
    } catch {
      setProblem(t("broadcasts.sendFailed", "Could not send the broadcast."));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const filters = audienceFilterCount(draft.audience);

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
        <SheetContent side="right" className="w-full gap-5 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {broadcast
                ? t("broadcasts.editTitle", "Edit broadcast")
                : t("broadcasts.newTitle", "New broadcast")}
            </SheetTitle>
            <SheetDescription>
              {t(
                "broadcasts.subtitle",
                "One message to many customers. It cannot be recalled once it starts sending."
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("broadcasts.name", "Broadcast name")}</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={t("broadcasts.namePlaceholder", "e.g. Eid offer — 10% off")}
                data-testid="broadcast-name"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("broadcasts.channel", "Channel")}</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(value) => {
                    // base-ui reports `null` only when a selection is cleared,
                    // which this select offers no way to do — keep the current
                    // channel if it ever does.
                    const channel = value ?? draft.channel;
                    // Clearing the template when leaving WhatsApp: a WhatsApp
                    // template id on a Messenger broadcast is a field nothing
                    // reads, and it would resurface if the channel was switched
                    // back.
                    setDraft({
                      ...draft,
                      channel,
                      templateId: requiresTemplate(channel) ? draft.templateId : "",
                    });
                  }}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="broadcast-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BROADCAST_PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {t(`templates.channel.${platform}`, platform)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("broadcasts.agent", "AI Agent")}</Label>
                <Select
                  value={draft.chatbotId || "__all__"}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      chatbotId: value && value !== "__all__" ? value : "",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      {t("filters.workspaceWide", "Workspace-wide")}
                    </SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {needsTemplate && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("broadcasts.template", "WhatsApp template")}
                </Label>
                {templates.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
                    {t("builder.noTemplates", "No templates yet — create one under Templates first.")}
                  </p>
                ) : (
                  <Select
                    value={draft.templateId || ""}
                    onValueChange={(value) => setDraft({ ...draft, templateId: value ?? "" })}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid="broadcast-template">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.templateId} value={template.templateId}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedTemplate && !templateApproved && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-primary/25 bg-primary/5 p-2 text-[11px] text-foreground">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span>
                      {t(
                        "broadcasts.templateNotApproved",
                        "This template is not marked approved. WhatsApp rejects a business-initiated message that uses an unapproved template, so every recipient outside the 24-hour window will fail."
                      )}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("broadcasts.body", "Message")}</Label>
              <Textarea
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                rows={5}
                placeholder={t("broadcasts.bodyPlaceholder", "Hi {{name}}, …")}
                data-testid="broadcast-body"
              />
              <p className="text-[11px] text-muted-foreground">
                {/* The variable list is passed as a value, not written into the
                    translation: i18next would otherwise treat `{{name}}` as an
                    interpolation and render it as an empty string. */}
                {t("broadcasts.bodyHint", "These are filled in per customer: {{list}}", {
                  list: TEMPLATE_VARIABLE_TOKENS.join(", "),
                })}
              </p>
            </div>

            {/* ── Audience ─────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-foreground">
                  {t("broadcasts.audience", "Audience")}
                </p>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    filters === 0
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-border bg-card text-foreground"
                  )}
                  data-testid="broadcast-reach"
                >
                  {previewing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Users className="h-3 w-3" />
                  )}
                  {preview
                    ? t("broadcasts.reach", "{{count}} contacts", { count: preview.reachable })
                    : t("broadcasts.reachUnknown", "Counting…")}
                </span>
              </div>

              <AudienceEditor
                audience={draft.audience}
                tags={tags}
                onChange={(audience) => setDraft({ ...draft, audience })}
              />

              {/* No filter means everyone — which is legal but is the most
                  expensive mistake available here, so it is called out. */}
              {filters === 0 && (
                <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-[11px] text-destructive">
                  {t(
                    "broadcasts.noFilters",
                    "No filters — this reaches every contact who can be messaged. Add a tag or a recency filter unless you really mean everyone."
                  )}
                </p>
              )}

              {preview && preview.unreachable > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t(
                    "broadcasts.unreachable",
                    "{{count}} of these cannot receive a push message (web widget visitors) and are left out.",
                    { count: preview.unreachable }
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t("broadcasts.scheduledAt", "Schedule (optional)")}
              </Label>
              <Input
                type="datetime-local"
                value={draft.scheduledAt}
                onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "broadcasts.scheduledHint",
                  "Leave empty to keep it as a draft. The audience is resolved at send time, so people who unsubscribe in between are skipped."
                )}
              </p>
            </div>

            {problem && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
              >
                {problem}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("builder.cancel", "Cancel")}
            </Button>
            <Button variant="outline" onClick={save} disabled={saving} data-testid="broadcast-save">
              {saving && <Loader2 className="animate-spin" />}
              {t("broadcasts.saveDraft", "Save")}
            </Button>
            <Button
              onClick={() => setConfirming(true)}
              disabled={saving || (preview?.reachable ?? 0) === 0}
              className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
              data-testid="broadcast-send"
            >
              <Send className="h-4 w-4" />
              {t("broadcasts.sendNow", "Send now")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={confirming}
        title={t("broadcasts.confirmTitle", "Send to {{count}} contacts?", {
          count: preview?.reachable ?? 0,
        })}
        body={t(
          "broadcasts.confirmBody",
          "This cannot be undone or recalled. Each customer receives the message once."
        )}
        busy={saving}
        testId="broadcast-send-confirm"
        confirmLabel={t("broadcasts.sendNow", "Send now")}
        onOpenChange={setConfirming}
        onConfirm={saveAndSend}
      />
    </>
  );
}

function initialState(broadcast: Broadcast | null): ComposerState {
  if (!broadcast) {
    return {
      name: "",
      chatbotId: "",
      channel: "whatsapp",
      templateId: "",
      body: "",
      audience: emptyAudience(),
      scheduledAt: "",
    };
  }

  return {
    name: broadcast.name,
    chatbotId: broadcast.chatbotId ?? "",
    channel: broadcast.channel,
    templateId: broadcast.templateId ?? "",
    body: broadcast.body,
    audience: broadcast.audience,
    // `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time; an ISO string
    // with a `Z` is not accepted by the input, so it has to be converted back.
    scheduledAt: broadcast.scheduledAt ? toLocalInput(broadcast.scheduledAt) : "",
  };
}

/** ISO → the `datetime-local` format, in the browser's own timezone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
