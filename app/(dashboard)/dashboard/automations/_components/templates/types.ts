import type { WaTemplateStatus } from "@/lib/automations/schema";
import { TEMPLATE_VARIABLE_KEYS } from "@/lib/automations/templates";

/**
 * `MessageTemplateDto` — what `GET /api/automations/templates` returns.
 *
 * `waStatus` is read-only here even though the API accepts a status-only PATCH.
 * The merchant never *sets* an approval; they record what Meta told them, which
 * is why the field is separated from `TemplateDraft` below rather than living
 * in one type that the editor could accidentally submit.
 */
export interface MessageTemplate {
  templateId: string;
  name: string;
  channel: string;
  category: string;
  language: string;
  body: string;
  headerType: string | null;
  headerValue: string | null;
  buttons: unknown;
  waStatus: string;
  waTemplateId: string | null;
  waRejectedReason: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A button row in the editor. `value` is unused for a quick reply. */
export interface TemplateButtonDraft {
  type: "quick_reply" | "url" | "phone";
  label: string;
  value: string;
}

/**
 * The editor's working state.
 *
 * Every field is a string (or a string array) because that is what form inputs
 * hold. Parsing happens once, on save, through `templateWriteSchema` — the same
 * schema the API validates with, so the client cannot accept something the
 * server would reject.
 */
export interface TemplateDraft {
  name: string;
  channel: string;
  category: string;
  language: string;
  body: string;
  headerType: string;
  headerValue: string;
  buttons: TemplateButtonDraft[];
  archived: boolean;
}

export function emptyTemplateDraft(): TemplateDraft {
  return {
    name: "",
    // `all` is the honest default: most merchants write one message and use it
    // on every channel they have connected.
    channel: "all",
    category: "utility",
    language: "bn",
    body: "",
    headerType: "none",
    headerValue: "",
    buttons: [],
    archived: false,
  };
}

/**
 * The `{{…}}` spellings of every variable the engine can fill in, for display.
 *
 * Derived from `TEMPLATE_VARIABLE_KEYS` rather than written out again: that
 * list is what `renderTemplate` actually resolves, and a second copy here would
 * eventually advertise a variable the engine silently replaces with an empty
 * string.
 */
export const TEMPLATE_VARIABLE_TOKENS = TEMPLATE_VARIABLE_KEYS.map((key) => `{{${key}}}`);

/** WhatsApp approval state, and how each one presents. */
export const WA_STATUS_STYLES: Record<WaTemplateStatus, { className: string; dot: string }> = {
  not_submitted: { className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  pending: { className: "bg-primary/10 text-primary border-primary/25", dot: "bg-primary" },
  approved: { className: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  rejected: { className: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

/** Narrow a stored `buttons` JSON column into editor rows. */
export function readButtons(value: unknown): TemplateButtonDraft[] {
  if (!Array.isArray(value)) return [];

  const buttons: TemplateButtonDraft[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.label !== "string") continue;

    const type =
      record.type === "url" || record.type === "phone" || record.type === "quick_reply"
        ? record.type
        : "quick_reply";

    buttons.push({
      type,
      label: record.label,
      value: typeof record.value === "string" ? record.value : "",
    });
  }
  return buttons;
}

/**
 * The stored `buttons` JSON, reshaped for `templateWriteSchema`.
 *
 * Distinct from `readButtons` in one way that matters: a `quick_reply` row must
 * go back with no `value` key at all. The schema's refinement rejects an empty
 * string, so archiving a template — which resends the whole record — would fail
 * on a template that was perfectly valid when it was created.
 */
export function buttonsForWrite(value: unknown) {
  return readButtons(value).map((button) =>
    button.type === "quick_reply"
      ? { type: button.type, label: button.label }
      : { type: button.type, label: button.label, value: button.value }
  );
}
