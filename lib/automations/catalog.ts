/**
 * Automation catalog — the metadata that drives the rule builder.
 *
 * The schema in `./schema.ts` answers "is this rule valid?". This file answers
 * the builder's questions: which triggers exist, which of them make sense for
 * the agent's connected channels, what config each one needs, and what input
 * to render for every condition field and action.
 *
 * Keeping it declarative means the builder is a generic renderer instead of a
 * hand-written form per trigger — adding a trigger becomes one schema entry
 * plus one catalog entry, with no new components.
 *
 * Labels are not stored here. The builder resolves `triggers.<type>.label`,
 * `conditions.<field>.label` and `actions.<type>.label` from the
 * `automations` i18n namespace, so nothing here needs translating.
 */

import {
  ACTION_TYPES,
  CONDITION_FIELDS,
  TRIGGER_TYPES,
  type ActionType,
  type ConditionField,
  type TriggerFamily,
  type TriggerType,
} from "./schema";

// ── Field descriptors ─────────────────────────────────────────────────────────

/**
 * The input kinds the builder knows how to render. Anything a trigger or
 * action needs has to reduce to one of these; a trigger needing a bespoke
 * widget would be a sign the config shape is wrong.
 */
export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "time"
  | "switch"
  | "tag"
  | "url";

export interface FieldOption {
  value: string;
}

export interface FieldSpec {
  key: string;
  kind: FieldKind;
  options?: FieldOption[];
  min?: number;
  max?: number;
  /** Shown under the input — explains a platform limit or a default. */
  hintKey?: string;
}

export interface TriggerSpec {
  type: TriggerType;
  family: TriggerFamily;
  /** Lucide icon name. */
  icon: string;
  /**
   * Channels this trigger can fire on. Absent = every channel. The builder
   * hides a trigger when the selected agent has none of these connected,
   * rather than offering one that can never fire.
   */
  channels?: string[];
  fields: FieldSpec[];
}

export const TRIGGER_CATALOG: Record<TriggerType, TriggerSpec> = {
  "message.received": {
    type: "message.received",
    family: "messaging",
    icon: "MessageSquare",
    fields: [],
  },
  "keyword.match": {
    type: "keyword.match",
    family: "messaging",
    icon: "Tags",
    fields: [
      { key: "keywords", kind: "text", hintKey: "keywords" },
      {
        key: "matchMode",
        kind: "select",
        options: [{ value: "contains" }, { value: "exact" }, { value: "regex" }],
      },
      { key: "caseSensitive", kind: "switch" },
    ],
  },
  "conversation.first_message": {
    type: "conversation.first_message",
    family: "messaging",
    icon: "Hand",
    fields: [],
  },
  "comment.created": {
    type: "comment.created",
    family: "social",
    icon: "MessageCircle",
    channels: ["facebook", "instagram"],
    fields: [
      { key: "keywords", kind: "text", hintKey: "commentKeywords" },
      { key: "sendPrivateDM", kind: "switch" },
    ],
  },
  "schedule.outside_business_hours": {
    type: "schedule.outside_business_hours",
    family: "time",
    icon: "MoonStar",
    fields: [
      { key: "from", kind: "time", hintKey: "businessHoursFallback" },
      { key: "to", kind: "time", hintKey: "businessHoursFallback" },
      { key: "timezone", kind: "text" },
    ],
  },
  "session.idle": {
    type: "session.idle",
    family: "time",
    icon: "Clock",
    fields: [
      { key: "idleMinutes", kind: "number", min: 5, max: 20160 },
      { key: "onlyActive", kind: "switch" },
    ],
  },
  "order.created": {
    type: "order.created",
    family: "commerce",
    icon: "ShoppingBag",
    fields: [],
  },
  "order.status_changed": {
    type: "order.status_changed",
    family: "commerce",
    icon: "Truck",
    fields: [
      {
        key: "statuses",
        kind: "multiselect",
        options: [
          { value: "Processing" },
          { value: "Shipped" },
          { value: "Delivered" },
          { value: "Returned" },
        ],
      },
    ],
  },
  "cart.abandoned": {
    type: "cart.abandoned",
    family: "commerce",
    icon: "ShoppingCart",
    fields: [{ key: "afterMinutes", kind: "number", min: 15, max: 20160 }],
  },
  "handover.requested": {
    type: "handover.requested",
    family: "inbox",
    icon: "UserRound",
    fields: [],
  },
  "ai.paused": {
    type: "ai.paused",
    family: "inbox",
    icon: "BotOff",
    fields: [],
  },
  "lead.status_changed": {
    type: "lead.status_changed",
    family: "inbox",
    icon: "Star",
    fields: [
      {
        key: "statuses",
        kind: "multiselect",
        options: [
          { value: "high_prospect" },
          { value: "priority" },
          { value: "risky" },
          { value: "successful" },
          { value: "none" },
        ],
      },
    ],
  },
  "sentiment.changed": {
    type: "sentiment.changed",
    family: "inbox",
    icon: "TriangleAlert",
    fields: [
      {
        key: "values",
        kind: "multiselect",
        options: [{ value: "positive" }, { value: "neutral" }, { value: "negative" }],
      },
    ],
  },
  "tag.added": {
    type: "tag.added",
    family: "inbox",
    icon: "Tag",
    fields: [{ key: "tagId", kind: "tag" }],
  },
};

// ── Conditions ────────────────────────────────────────────────────────────────

/** What the value input looks like for a condition field. */
export type ConditionValueKind = "text" | "number" | "boolean" | "select" | "multiselect" | "tag";

export interface ConditionFieldSpec {
  field: ConditionField;
  valueKind: ConditionValueKind;
  options?: FieldOption[];
  /** Operators worth offering. Omitted = the full list from the schema. */
  ops?: string[];
}

const BOOLEAN_OPTIONS: FieldOption[] = [{ value: "true" }, { value: "false" }];

export const CONDITION_CATALOG: Record<ConditionField, ConditionFieldSpec> = {
  channel: {
    field: "channel",
    valueKind: "multiselect",
    options: [
      { value: "facebook" },
      { value: "instagram" },
      { value: "whatsapp" },
      { value: "web" },
    ],
  },
  chatbotId: { field: "chatbotId", valueKind: "text" },
  integrationId: { field: "integrationId", valueKind: "text" },
  isFirstMessage: { field: "isFirstMessage", valueKind: "boolean", options: BOOLEAN_OPTIONS },
  hasPhone: { field: "hasPhone", valueKind: "boolean", options: BOOLEAN_OPTIONS },
  hasAddress: { field: "hasAddress", valueKind: "boolean", options: BOOLEAN_OPTIONS },
  leadStatus: {
    field: "leadStatus",
    valueKind: "select",
    options: [
      { value: "high_prospect" },
      { value: "priority" },
      { value: "risky" },
      { value: "successful" },
      { value: "none" },
    ],
  },
  sentiment: {
    field: "sentiment",
    valueKind: "select",
    options: [{ value: "positive" }, { value: "neutral" }, { value: "negative" }],
  },
  language: {
    field: "language",
    valueKind: "select",
    options: [{ value: "bn" }, { value: "en" }, { value: "banglish" }],
  },
  messageText: { field: "messageText", valueKind: "text" },
  orderValue: { field: "orderValue", valueKind: "number", ops: ["gt", "lt", "eq"] },
  minutesSinceLastMessage: {
    field: "minutesSinceLastMessage",
    valueKind: "number",
    ops: ["gt", "lt"],
  },
  dayOfWeek: {
    field: "dayOfWeek",
    valueKind: "multiselect",
    options: [
      { value: "sunday" },
      { value: "monday" },
      { value: "tuesday" },
      { value: "wednesday" },
      { value: "thursday" },
      { value: "friday" },
      { value: "saturday" },
    ],
  },
  tagId: { field: "tagId", valueKind: "tag", ops: ["eq", "neq", "in", "not_in"] },
  aiActive: { field: "aiActive", valueKind: "boolean", options: BOOLEAN_OPTIONS },
};

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Action families decide grouping in the action picker and, more importantly,
 * the ordering constraint the engine relies on: `immediate` actions all run in
 * the same pass, which is what lets a linear rule stay linear.
 */
export type ActionCategory = "message" | "ai" | "crm" | "ops";

export interface ActionSpec {
  type: ActionType;
  category: ActionCategory;
  icon: string;
  channels?: string[];
  fields: FieldSpec[];
}

export const ACTION_CATALOG: Record<ActionType, ActionSpec> = {
  send_text: {
    type: "send_text",
    category: "message",
    icon: "MessageSquare",
    fields: [{ key: "body", kind: "textarea", max: 4000, hintKey: "variables" }],
  },
  send_template: {
    type: "send_template",
    category: "message",
    icon: "FileText",
    fields: [{ key: "templateId", kind: "select" }],
  },
  send_media: {
    type: "send_media",
    category: "message",
    icon: "Image",
    fields: [
      { key: "mediaUrl", kind: "url" },
      {
        key: "mediaType",
        kind: "select",
        options: [{ value: "image" }, { value: "audio" }, { value: "video" }, { value: "file" }],
      },
      { key: "caption", kind: "text", max: 1000 },
    ],
  },
  send_quick_replies: {
    type: "send_quick_replies",
    category: "message",
    icon: "ListChecks",
    channels: ["facebook", "instagram", "whatsapp"],
    fields: [
      { key: "body", kind: "textarea", max: 4000, hintKey: "variables" },
      { key: "buttons", kind: "text", hintKey: "maxThreeButtons" },
    ],
  },
  ai_reply: {
    type: "ai_reply",
    category: "ai",
    icon: "Sparkles",
    fields: [],
  },
  handoff_to_human: {
    type: "handoff_to_human",
    category: "ai",
    icon: "UserRound",
    fields: [
      { key: "note", kind: "text", max: 500 },
      { key: "muteAi", kind: "switch" },
    ],
  },
  pause_ai: { type: "pause_ai", category: "ai", icon: "BotOff", fields: [] },
  resume_ai: { type: "resume_ai", category: "ai", icon: "Bot", fields: [] },
  add_tag: { type: "add_tag", category: "crm", icon: "Tag", fields: [{ key: "tagId", kind: "tag" }] },
  remove_tag: {
    type: "remove_tag",
    category: "crm",
    icon: "TagOff",
    fields: [{ key: "tagId", kind: "tag" }],
  },
  set_lead_status: {
    type: "set_lead_status",
    category: "crm",
    icon: "Star",
    fields: [
      {
        key: "value",
        kind: "select",
        options: [
          { value: "high_prospect" },
          { value: "priority" },
          { value: "risky" },
          { value: "successful" },
          { value: "none" },
        ],
      },
    ],
  },
  add_note: {
    type: "add_note",
    category: "crm",
    icon: "StickyNote",
    fields: [{ key: "text", kind: "textarea", max: 1000 }],
  },
  notify_merchant: {
    type: "notify_merchant",
    category: "ops",
    icon: "Bell",
    fields: [
      { key: "title", kind: "text", max: 200 },
      {
        key: "message",
        kind: "textarea",
        max: 1000,
        hintKey: "variables",
      },
    ],
  },
  send_email: {
    type: "send_email",
    category: "ops",
    icon: "Mail",
    fields: [
      { key: "to", kind: "text" },
      { key: "subject", kind: "text", max: 200 },
      { key: "body", kind: "textarea", hintKey: "variables" },
    ],
  },
  webhook: {
    type: "webhook",
    category: "ops",
    icon: "Webhook",
    fields: [
      { key: "url", kind: "url" },
      { key: "method", kind: "select", options: [{ value: "POST" }, { value: "GET" }] },
      { key: "bodyTemplate", kind: "textarea", hintKey: "variables" },
    ],
  },
  assign_to_agent: {
    type: "assign_to_agent",
    category: "ops",
    icon: "UserCheck",
    fields: [{ key: "userId", kind: "text", hintKey: "singleOperatorFallback" }],
  },
  close_conversation: {
    type: "close_conversation",
    category: "ops",
    icon: "CheckCheck",
    fields: [],
  },
};

// ── Lookups ───────────────────────────────────────────────────────────────────

/**
 * Triggers that can actually fire for the given connected channels. A trigger
 * with no `channels` restriction is always offered.
 *
 * An empty `channels` array means "nothing is connected yet" — in that case
 * every unrestricted trigger is still shown, because the merchant has to be
 * able to build a rule before wiring up a channel.
 */
export function availableTriggers(channels: string[]): TriggerSpec[] {
  const connected = new Set(channels.map((channel) => channel.toLowerCase()));
  return TRIGGER_TYPES.map((type) => TRIGGER_CATALOG[type]).filter(
    (spec) => !spec.channels || connected.size === 0 || spec.channels.some((c) => connected.has(c))
  );
}

/** Actions that can actually deliver on the given connected channels. */
export function availableActions(channels: string[]): ActionSpec[] {
  const connected = new Set(channels.map((channel) => channel.toLowerCase()));
  return ACTION_TYPES.map((type) => ACTION_CATALOG[type]).filter(
    (spec) => !spec.channels || connected.size === 0 || spec.channels.some((c) => connected.has(c))
  );
}

/** Triggers grouped for the picker's family sections. */
export function triggersByFamily(channels: string[]): Record<TriggerFamily, TriggerSpec[]> {
  const grouped: Record<TriggerFamily, TriggerSpec[]> = {
    messaging: [],
    social: [],
    time: [],
    commerce: [],
    inbox: [],
  };
  for (const spec of availableTriggers(channels)) {
    grouped[spec.family].push(spec);
  }
  return grouped;
}

export { ACTION_TYPES, CONDITION_FIELDS, TRIGGER_TYPES };
