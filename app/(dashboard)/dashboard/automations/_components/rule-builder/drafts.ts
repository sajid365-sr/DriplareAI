import {
  actionSchema,
  conditionSchema,
  triggerSchema,
  type ActionType,
  type AutomationAction,
  type AutomationCondition,
  type TriggerType,
} from "@/lib/automations/schema";

/**
 * Draft shapes for the rule builder.
 *
 * The schemas in `lib/automations/schema.ts` describe *stored* rules, where
 * most fields carry `.default()` and may legitimately be absent. A form cannot
 * work that way: a field with no value is either empty or invisible, and a
 * merchant who picks `keyword.match` must land on a keyword input rather than
 * on a rule that fails validation with no visible cause.
 *
 * So every field a user is expected to fill is seeded here with a starting
 * value, and required fields that have no sensible default (`orderValue`) are
 * seeded with an obviously-wrong placeholder the merchant will replace.
 */

/** Starting config for each trigger type. */
export function emptyTrigger(type: TriggerType): Record<string, unknown> {
  switch (type) {
    case "keyword.match":
      return { type, keywords: [], matchMode: "contains", caseSensitive: false };
    case "comment.created":
      return { type, keywords: [], sendPrivateDM: true };
    case "schedule.outside_business_hours":
      return { type, timezone: "Asia/Dhaka" };
    case "session.idle":
      return { type, idleMinutes: 60, onlyActive: true };
    case "order.status_changed":
      return { type, statuses: ["Shipped"] };
    case "cart.abandoned":
      return { type, afterMinutes: 120 };
    case "lead.status_changed":
      return { type, statuses: ["high_prospect"] };
    case "sentiment.changed":
      return { type, values: ["negative"] };
    case "tag.added":
      return { type, tagId: "" };
    default:
      // Every remaining trigger takes no configuration at all.
      return { type };
  }
}

/**
 * A stable client-side key for one row of the builder.
 *
 * React reconciles by key, and these rows are edited in place while being
 * reordered and deleted. Keying by array index makes a delete look like the
 * *last* row disappeared and every value shifted up — which is exactly what
 * React does when the keys are positions.
 *
 * Zod strips unknown keys, so `__key` never reaches the database or the API
 * payload: it exists only for as long as the form is open.
 */
export interface RowKey {
  __key: string;
}

export type ActionDraft = Record<string, unknown> & RowKey;
export type ConditionDraft = AutomationCondition & RowKey;

export function rowKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `row_${Math.random().toString(36).slice(2)}`;
}

/** Give a stored rule's rows keys so the editor can render them safely. */
export function keyActions(actions: Record<string, unknown>[]): ActionDraft[] {
  return actions.map((action) => ({ ...action, __key: rowKey() }));
}

export function keyConditions(conditions: AutomationCondition[]): ConditionDraft[] {
  return conditions.map((condition) => ({ ...condition, __key: rowKey() }));
}

/** Starting config for each action type. */
export function emptyAction(type: ActionType): ActionDraft {
  const fields = actionFields(type);
  return { ...fields, __key: rowKey() };
}

function actionFields(type: ActionType): Record<string, unknown> {
  switch (type) {
    case "send_text":
      return { type, body: "" };
    case "send_template":
      return { type, templateId: "" };
    case "send_media":
      return { type, mediaUrl: "", mediaType: "image" };
    case "send_quick_replies":
      return { type, body: "", buttons: [] };
    case "handoff_to_human":
      return { type, note: "", muteAi: true };
    case "add_tag":
    case "remove_tag":
      return { type, tagId: "" };
    case "set_lead_status":
      return { type, value: "high_prospect" };
    case "add_note":
      return { type, text: "" };
    case "notify_merchant":
      return { type, title: "", message: "" };
    case "send_email":
      return { type, to: "", subject: "", body: "" };
    case "webhook":
      return { type, url: "", method: "POST" };
    case "assign_to_agent":
      return { type, userId: "" };
    default:
      return { type };
  }
}

export function emptyCondition(): ConditionDraft {
  return { field: "channel", op: "eq", value: "facebook", __key: rowKey() };
}

/**
 * Parse a draft trigger.
 *
 * The builder keeps the trigger as a loose record while it is being edited —
 * typing "https://" into a URL field passes through states no schema accepts —
 * so validation happens here, at the edge of saving, rather than on every
 * keystroke.
 */
export function parseTriggerDraft(draft: Record<string, unknown>) {
  const candidate = { ...draft, keywords: normalizeList(draft.keywords) };
  return triggerSchema.safeParse(candidate);
}

export function parseConditionDraft(draft: ConditionDraft) {
  return conditionSchema.safeParse(draft);
}

export function parseActionDraft(draft: ActionDraft) {
  return actionSchema.safeParse(dropEmptyOptional(draft));
}

/**
 * Drop an empty optional string before validating.
 *
 * `assign_to_agent.userId` is optional, and `""` is a valid string as far as
 * the schema is concerned — it would be stored as the literal empty user id.
 * Omitting the key is what the schema documents as "assign to the workspace
 * owner", so the empty case has to become an absence rather than a value.
 */
function dropEmptyOptional(draft: Record<string, unknown>): Record<string, unknown> {
  if (draft.type === "assign_to_agent" && draft.userId === "") {
    const { userId: _ignored, ...rest } = draft;
    return rest;
  }
  return draft;
}

/**
 * Comma-separated text into a keyword list.
 *
 * The catalog models `keywords` as a `text` field because one input with commas
 * is far faster to fill than a chip editor that needs a click per keyword — and
 * Bengali keywords are usually typed in one go.
 */
export function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Turn a list back into the comma-separated text the input shows. */
export function listToText(value: unknown): string {
  return normalizeList(value).join(", ");
}

/** Quick replies arrive as a comma-separated label list, saved as payload pairs. */
export function buttonsToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) =>
      entry && typeof entry === "object" && "label" in entry ? String((entry as { label: unknown }).label) : ""
    )
    .filter(Boolean)
    .join(", ");
}

export function textToButtons(value: unknown): { label: string; payload: string }[] {
  return normalizeList(value).map((label, index) => ({
    label: label.slice(0, 20),
    payload: slugify(label) || `button_${index + 1}`,
  }));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type { ActionType, AutomationAction, AutomationCondition, TriggerType };
