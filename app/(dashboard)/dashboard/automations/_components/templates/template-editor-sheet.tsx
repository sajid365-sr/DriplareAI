"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CHANNELS,
  TEMPLATE_HEADER_TYPES,
  WA_TEMPLATE_STATUSES,
} from "@/lib/automations/schema";

import {
  TEMPLATE_VARIABLE_TOKENS,
  emptyTemplateDraft,
  readButtons,
  type MessageTemplate,
  type TemplateButtonDraft,
  type TemplateDraft,
} from "./types";

/**
 * Create or edit a message template.
 *
 * One form for both, keyed from outside so switching templates remounts it —
 * the same approach the rule builder takes, and for the same reason: a
 * half-filled form carrying the previous template's state is the classic way to
 * silently overwrite the wrong record.
 *
 * The WhatsApp approval section appears only when the template can reach
 * WhatsApp. It is a *record* of what Meta decided, not a control — Driplare does
 * not submit templates to Meta in this release, so the merchant copies the
 * status across from WhatsApp Manager. Labelling it as anything other than a
 * record would promise an integration that does not exist.
 */
export function TemplateEditorSheet({
  open,
  template,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** `null` = creating a new template. */
  template: MessageTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("automations");

  const [draft, setDraft] = useState<TemplateDraft>(() =>
    template ? draftFromTemplate(template) : emptyTemplateDraft()
  );
  const [waStatus, setWaStatus] = useState(() => template?.waStatus ?? "not_submitted");
  const [waTemplateId, setWaTemplateId] = useState(() => template?.waTemplateId ?? "");
  const [waRejectedReason, setWaRejectedReason] = useState(
    () => template?.waRejectedReason ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function patch(next: Partial<TemplateDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function addButton() {
    patch({ buttons: [...draft.buttons, { type: "quick_reply", label: "", value: "" }] });
  }

  function updateButton(index: number, next: Partial<TemplateButtonDraft>) {
    patch({
      buttons: draft.buttons.map((button, i) => (i === index ? { ...button, ...next } : button)),
    });
  }

  async function save() {
    const failure = findProblem(draft, t);
    if (failure) {
      setProblem(failure);
      return;
    }

    setSaving(true);
    setProblem(null);
    try {
      const body = toPayload(draft);
      const response = await fetch(
        template
          ? `/api/automations/templates/${template.templateId}`
          : "/api/automations/templates",
        {
          method: template ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setProblem(data?.error ?? t("templates.saveFailed", "Could not save the template."));
        return;
      }

      // The approval status is a second, deliberately separate payload — see
      // the note in `/api/automations/templates/[templateId]`. It is only sent
      // when the merchant actually changed it, so an ordinary edit of an
      // approved template cannot accidentally restate the approval.
      if (template && waStatus !== template.waStatus) {
        await fetch(`/api/automations/templates/${template.templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waStatus,
            waTemplateId: waTemplateId.trim() || null,
            waRejectedReason: waStatus === "rejected" ? waRejectedReason.trim() || null : null,
          }),
        });
      }

      onSaved();
    } catch {
      setProblem(t("templates.saveFailed", "Could not save the template."));
    } finally {
      setSaving(false);
    }
  }

  const reachesWhatsApp = draft.channel === "whatsapp" || draft.channel === "all";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <SheetContent side="right" className="w-full gap-5 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {template
              ? t("templates.editTitle", "Edit template")
              : t("templates.newTitle", "New template")}
          </SheetTitle>
          <SheetDescription>
            {t(
              "templates.subtitle",
              "Reusable message copy. WhatsApp only delivers a business-initiated message that uses an approved template."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("templates.name", "Template name")}</Label>
            <Input
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder={t("templates.namePlaceholder", "e.g. COD confirmation")}
              data-testid="template-name"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("templates.channelLabel", "Channel")}>
              <Select
                value={draft.channel}
                onValueChange={(value) => patch({ channel: value ?? draft.channel })}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="template-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {t(`templates.channel.${channel}`, channel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("templates.categoryLabel", "Category")}>
              <Select
                value={draft.category}
                onValueChange={(value) => patch({ category: value ?? draft.category })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`templates.category.${category}`, category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("templates.languageLabel", "Language")}>
              <Select
                value={draft.language}
                onValueChange={(value) => patch({ language: value ?? draft.language })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bn">বাংলা</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("templates.headerType", "Header")}>
              <Select
                value={draft.headerType}
                onValueChange={(value) => {
                  const headerType = value ?? draft.headerType;
                  // Clearing the value with the type: a leftover image URL on a
                  // header that no longer shows an image is the kind of stale
                  // field that fails validation on a later save for no visible
                  // reason.
                  patch({
                    headerType,
                    headerValue: headerType === "none" ? "" : draft.headerValue,
                  });
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_HEADER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`templates.header.${type}`, type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {draft.headerType !== "none" && (
              <div className="sm:col-span-2">
                <Field
                  label={
                    draft.headerType === "text"
                      ? t("templates.headerText", "Header text")
                      : t("templates.headerUrl", "Media URL")
                  }
                >
                  <Input
                    value={draft.headerValue}
                    onChange={(event) => patch({ headerValue: event.target.value })}
                    placeholder={
                      draft.headerType === "text" ? "Order update" : "https://…/image.jpg"
                    }
                  />
                </Field>
              </div>
            )}
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("templates.body", "Message")}</Label>
            <Textarea
              value={draft.body}
              onChange={(event) => patch({ body: event.target.value })}
              rows={5}
              placeholder={t("templates.bodyPlaceholder", "Hi {{name}}, your order is confirmed.")}
              data-testid="template-body"
            />
            <p className="text-[11px] text-muted-foreground">
              {/* The list is passed as a value: written into the translation,
                  i18next would read `{{name}}` as an interpolation and render
                  it as an empty string. */}
              {t("templates.variablesHint", "You can use: {{list}}", {
                list: TEMPLATE_VARIABLE_TOKENS.join(", "),
              })}
            </p>
          </div>

          {/* ── Buttons ────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{t("templates.buttons", "Buttons")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addButton}
                disabled={draft.buttons.length >= 3}
                className="text-muted-foreground"
              >
                <Plus />
                {t("templates.addButton", "Add button")}
              </Button>
            </div>

            {draft.buttons.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
                {t("templates.noButtons", "Optional. Up to three, sent as separate rows.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.buttons.map((button, index) => (
                  <li
                    key={index}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-2.5 sm:flex-row sm:items-center"
                  >
                    <Select
                      value={button.type}
                      onValueChange={(value) =>
                        updateButton(index, {
                          type: value as TemplateButtonDraft["type"],
                          value: value === "quick_reply" ? "" : button.value,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick_reply">
                          {t("templates.buttonType.quick_reply", "Quick reply")}
                        </SelectItem>
                        <SelectItem value="url">
                          {t("templates.buttonType.url", "Website")}
                        </SelectItem>
                        <SelectItem value="phone">
                          {t("templates.buttonType.phone", "Phone")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={button.label}
                      onChange={(event) => updateButton(index, { label: event.target.value })}
                      placeholder={t("templates.buttonLabel", "Label")}
                      className="h-8 flex-1 text-xs"
                      maxLength={25}
                    />

                    {button.type !== "quick_reply" && (
                      <Input
                        value={button.value}
                        onChange={(event) => updateButton(index, { value: event.target.value })}
                        placeholder={
                          button.type === "url" ? "https://…" : t("templates.phone", "+8801…")
                        }
                        className="h-8 flex-1 text-xs"
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        patch({ buttons: draft.buttons.filter((_, i) => i !== index) })
                      }
                      aria-label={t("builder.remove", "Remove")}
                      className="self-end text-muted-foreground hover:text-destructive sm:self-auto"
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── WhatsApp approval (record only) ─────────────────────────────── */}
          {reachesWhatsApp && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div>
                <p className="text-xs font-bold text-foreground">
                  {t("templates.approvalTitle", "WhatsApp approval")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t(
                    "templates.approvalHint",
                    "Driplare does not submit templates to Meta yet — copy the status across from WhatsApp Manager so broadcasts know what they can use."
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("templates.approvalStatus", "Status")}>
                  <Select
                    value={waStatus}
                    onValueChange={(value) => {
                      // `null` means the selection was cleared, which this select
                      // has no way to do — ignore it rather than blanking a
                      // status the merchant copied across from WhatsApp Manager.
                      if (value) setWaStatus(value);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid="template-wa-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WA_TEMPLATE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`templates.waStatus.${status}`, status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t("templates.approvalId", "Meta template name / id")}>
                  <Input
                    value={waTemplateId}
                    onChange={(event) => setWaTemplateId(event.target.value)}
                    placeholder={t("templates.approvalIdPlaceholder", "Optional")}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>

              {waStatus === "rejected" && (
                <Field label={t("templates.rejectedReason", "Why it was rejected")}>
                  <Input
                    value={waRejectedReason}
                    onChange={(event) => setWaRejectedReason(event.target.value)}
                    placeholder={t("templates.rejectedReasonPlaceholder", "Meta's reason")}
                    className="h-9 text-sm"
                  />
                </Field>
              )}

              {/* Editing the text of an approved template invalidates it. The
                  API resets the badge on save; saying so here is the difference
                  between a merchant understanding that and thinking the app
                  lost their approval. */}
              {template?.waStatus === "approved" &&
                draft.body.trim() !== template.body.trim() && (
                  <p className="rounded-lg border border-primary/25 bg-primary/5 p-2 text-[11px] text-foreground">
                    {t(
                      "templates.approvalWillReset",
                      "You changed the message text, so this template goes back to “not submitted” — Meta approves the exact wording, so a new text needs a new approval."
                    )}
                  </p>
                )}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2">
            <Switch
              checked={draft.archived}
              onCheckedChange={(checked) => patch({ archived: checked })}
              aria-label={t("templates.archived", "Archived")}
            />
            <span className="text-xs font-medium text-foreground">
              {t("templates.archiveHint", "Archive — hides it from pickers, keeps existing sends working")}
            </span>
          </label>

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
          <Button onClick={save} disabled={saving} data-testid="template-save">
            {saving ? t("builder.saving", "Saving…") : t("templates.save", "Save template")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function draftFromTemplate(template: MessageTemplate): TemplateDraft {
  return {
    name: template.name,
    channel: template.channel,
    category: template.category,
    language: template.language,
    body: template.body,
    headerType: template.headerType ?? "none",
    headerValue: template.headerValue ?? "",
    buttons: readButtons(template.buttons),
    archived: template.archived,
  };
}

/**
 * The exact shape `templateWriteSchema` expects.
 *
 * Two fields have to be *absent* rather than empty: a `quick_reply` carries no
 * value, and a header of `none` carries no value. Sending `""` for either is
 * rejected by the schema's refinement, so they are dropped here rather than
 * filtered out on the server.
 */
function toPayload(draft: TemplateDraft) {
  return {
    name: draft.name.trim(),
    channel: draft.channel,
    category: draft.category,
    language: draft.language,
    body: draft.body.trim(),
    headerType: draft.headerType,
    headerValue: draft.headerType === "none" ? null : draft.headerValue.trim() || null,
    buttons: draft.buttons.map((button) => ({
      type: button.type,
      label: button.label.trim(),
      ...(button.type === "quick_reply" ? {} : { value: button.value.trim() }),
    })),
    archived: draft.archived,
  };
}

/**
 * Client-side checks, in the merchant's language.
 *
 * The server validates with the same rules and is the authority; this exists so
 * the common mistakes produce a translated sentence next to the form instead of
 * a 400 with an English zod message.
 */
function findProblem(draft: TemplateDraft, t: (key: string, fallback: string) => string) {
  if (!draft.name.trim()) return t("templates.nameRequired", "Give the template a name.");
  if (!draft.body.trim()) return t("templates.bodyRequired", "A template needs a message body.");

  if (draft.headerType !== "none" && !draft.headerValue.trim()) {
    return t("templates.headerValueRequired", "The header you chose needs a value.");
  }

  for (const button of draft.buttons) {
    if (!button.label.trim()) {
      return t("templates.buttonLabelRequired", "Every button needs a label.");
    }
    if (button.type !== "quick_reply" && !button.value.trim()) {
      return t("templates.buttonValueRequired", "A website or phone button needs a destination.");
    }
  }

  return null;
}
