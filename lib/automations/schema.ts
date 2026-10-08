/**
 * Automation engine — validation schemas and shared types.
 *
 * Everything that reaches the engine (from the API, from n8n, or from a cron)
 * is validated here first. The `Automation.triggerConfig` / `conditions` /
 * `actions` / `graph` columns are JSON, so the database cannot constrain them —
 * this file is the only thing standing between a malformed rule and the
 * message pipeline.
 *
 * Scope note (V1): actions are *immediate*. Flow-control steps (`wait`,
 * `branch`, `goto`) belong to the flow canvas and are deliberately absent —
 * a linear rule cannot express them without a resumable state machine, and
 * pretending otherwise would produce rules that silently half-run.
 */

import { z } from "zod";

// ── Triggers ──────────────────────────────────────────────────────────────────

/**
 * Trigger families group the picker UI and decide which config fields apply.
 * `channelScoped` marks triggers that only exist on some platforms — the
 * builder hides them when the selected agent has no matching integration.
 */
export const TRIGGER_TYPES = [
  // Messaging
  "message.received",
  "keyword.match",
  "conversation.first_message",
  "comment.created",
  // Time
  "schedule.outside_business_hours",
  "session.idle",
  // Commerce
  "order.created",
  "order.status_changed",
  "cart.abandoned",
  // Inbox operations
  "handover.requested",
  "ai.paused",
  "lead.status_changed",
  "sentiment.changed",
  "tag.added",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const TRIGGER_FAMILIES = ["messaging", "social", "time", "commerce", "inbox"] as const;
export type TriggerFamily = (typeof TRIGGER_FAMILIES)[number];

const nonEmpty = z.string().trim().min(1);

/**
 * The `session.idle` branch, named on its own so the cron that *emits* these
 * events validates a rule's stored config with the same schema the engine uses
 * to read it. Two definitions of one shape is how they drift.
 */
const idleTrigger = z.object({
  type: z.literal("session.idle"),
  idleMinutes: z.number().int().min(5).max(20160).default(60),
  // Only nudge conversations that are still open.
  onlyActive: z.boolean().default(true),
});

export const idleTriggerSchema = idleTrigger;

export const triggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message.received") }),

  z.object({
    type: z.literal("keyword.match"),
    // Keywords are matched against the raw customer text, so Bengali and
    // Banglish entries ("দাম কত", "dam koto") sit in the same list as English.
    keywords: z.array(nonEmpty).min(1).max(50),
    matchMode: z.enum(["contains", "exact", "regex"]).default("contains"),
    caseSensitive: z.boolean().default(false),
  }),

  z.object({ type: z.literal("conversation.first_message") }),

  z.object({
    type: z.literal("comment.created"),
    // Empty = every comment on the page's posts.
    keywords: z.array(nonEmpty).max(50).default([]),
    sendPrivateDM: z.boolean().default(true),
  }),

  z.object({
    type: z.literal("schedule.outside_business_hours"),
    // Falls back to the workspace business hours when omitted.
    from: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    to: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: z.string().default("Asia/Dhaka"),
  }),

  idleTrigger,

  z.object({ type: z.literal("order.created") }),

  z.object({
    type: z.literal("order.status_changed"),
    statuses: z.array(z.enum(["Processing", "Shipped", "Delivered", "Returned"])).min(1),
  }),

  z.object({
    type: z.literal("cart.abandoned"),
    afterMinutes: z.number().int().min(15).max(20160).default(120),
  }),

  z.object({ type: z.literal("handover.requested") }),
  z.object({ type: z.literal("ai.paused") }),

  z.object({
    type: z.literal("lead.status_changed"),
    statuses: z
      .array(z.enum(["high_prospect", "priority", "risky", "successful", "none"]))
      .min(1),
  }),

  z.object({
    type: z.literal("sentiment.changed"),
    // Emitted by the Live Inbox analysis job, which already writes
    // `ChatSession.sentiment` — no new detection work is needed for this.
    values: z.array(z.enum(["positive", "neutral", "negative"])).min(1),
  }),

  z.object({ type: z.literal("tag.added"), tagId: z.string().optional() }),
]);

export type Trigger = z.infer<typeof triggerSchema>;

// ── Conditions ────────────────────────────────────────────────────────────────

export const CONDITION_FIELDS = [
  "channel",
  "chatbotId",
  "integrationId",
  "isFirstMessage",
  "hasPhone",
  "hasAddress",
  "leadStatus",
  "sentiment",
  "language",
  "messageText",
  "orderValue",
  "minutesSinceLastMessage",
  "dayOfWeek",
  "tagId",
  "aiActive",
] as const;

export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "contains",
  "regex",
  "gt",
  "lt",
  "exists",
  "not_exists",
] as const;

export type ConditionOp = (typeof CONDITION_OPS)[number];

const conditionValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const conditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  op: z.enum(CONDITION_OPS),
  // Optional because `exists` / `not_exists` need no operand — `superRefine`
  // below rejects a *missing* value only for the operators that do need one.
  value: conditionValue.optional(),
}).superRefine((cond, ctx) => {
  const needsValue = cond.op !== "exists" && cond.op !== "not_exists";
  if (needsValue && cond.value === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `Operator "${cond.op}" requires a value`,
    });
    return;
  }
  // List operators are the only ones that accept an array — catching this here
  // saves the engine from having to defend against it at runtime.
  const listOps: ConditionOp[] = ["in", "not_in"];
  if (listOps.includes(cond.op) && !Array.isArray(cond.value)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `Operator "${cond.op}" requires a list value`,
    });
  }
  if (!listOps.includes(cond.op) && Array.isArray(cond.value)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `Operator "${cond.op}" does not accept a list value`,
    });
  }
});

export type AutomationCondition = z.infer<typeof conditionSchema>;

// ── Actions ───────────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  "send_text",
  "send_template",
  "send_media",
  "send_quick_replies",
  "ai_reply",
  "handoff_to_human",
  "pause_ai",
  "resume_ai",
  "add_tag",
  "remove_tag",
  "set_lead_status",
  "add_note",
  "notify_merchant",
  "send_email",
  "webhook",
  "assign_to_agent",
  "close_conversation",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * Hosts a merchant-supplied webhook must never reach.
 *
 * A `webhook` action makes the server issue an HTTP request to an address the
 * merchant typed. Without this list, "https://169.254.169.254/latest/meta-data"
 * turns a rule builder into a cloud-credential reader, and
 * "http://localhost:5432" turns it into an internal port scanner. Both are
 * standard SSRF, and both are reachable from an ordinary rule form.
 *
 * This is a literal-host check only. A hostname that *resolves* to a private
 * address (DNS rebinding) still gets through — defending that needs the
 * resolved IP to be pinned and re-verified at connect time, which is worth
 * doing before webhooks are exposed to untrusted workspaces.
 */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^169\.254\./, // link-local, incl. cloud metadata
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // unique local IPv6
  /^metadata\./i,
];

/**
 * A URL check that does not depend on zod's `.url()` shim (whose API moved
 * between zod majors), that refuses non-HTTP schemes, and that refuses hosts
 * pointing back inside the network.
 */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return !BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

const httpUrl = nonEmpty.refine(isPublicHttpUrl, {
  message: "Must be a public http(s) URL",
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_text"),
    // 4000 chars is the Facebook Messenger hard limit; sending more would be
    // rejected by the platform mid-automation.
    body: z.string().trim().min(1).max(4000),
  }),

  z.object({ type: z.literal("send_template"), templateId: nonEmpty }),

  z.object({
    type: z.literal("send_media"),
    mediaUrl: httpUrl,
    mediaType: z.enum(["image", "audio", "video", "file"]).default("image"),
    caption: z.string().max(1000).optional(),
  }),

  z.object({
    type: z.literal("send_quick_replies"),
    body: z.string().trim().min(1).max(4000),
    // Messenger allows at most 3 quick replies per message.
    buttons: z
      .array(z.object({ label: z.string().trim().min(1).max(20), payload: nonEmpty }))
      .min(1)
      .max(3),
  }),

  z.object({ type: z.literal("ai_reply") }),

  z.object({
    type: z.literal("handoff_to_human"),
    note: z.string().max(500).optional(),
    // Mirrors `Integration.config.muteAiOnHandover`; the engine resolves the
    // channel setting first and this only overrides it for this one rule.
    muteAi: z.boolean().default(true),
  }),

  z.object({ type: z.literal("pause_ai") }),
  z.object({ type: z.literal("resume_ai") }),

  z.object({ type: z.literal("add_tag"), tagId: nonEmpty }),
  z.object({ type: z.literal("remove_tag"), tagId: nonEmpty }),

  z.object({
    type: z.literal("set_lead_status"),
    value: z.enum(["high_prospect", "priority", "risky", "successful", "none"]),
  }),

  z.object({ type: z.literal("add_note"), text: z.string().trim().min(1).max(1000) }),

  z.object({
    type: z.literal("notify_merchant"),
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(1000),
  }),

  z.object({
    type: z.literal("send_email"),
    to: z.string().trim().min(1),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
  }),

  z.object({
    type: z.literal("webhook"),
    url: httpUrl,
    method: z.enum(["POST", "GET"]).default("POST"),
    headers: z.record(z.string(), z.string()).default({}),
    bodyTemplate: z.string().max(20000).optional(),
  }),

  z.object({
    type: z.literal("assign_to_agent"),
    // V1 is single-operator: omitting the id assigns the workspace owner.
    userId: z.string().optional(),
  }),

  z.object({ type: z.literal("close_conversation") }),
]);

export type AutomationAction = z.infer<typeof actionSchema>;

// ── Rule ──────────────────────────────────────────────────────────────────────

export const quietHoursSchema = z.object({
  enabled: z.boolean().default(false),
  from: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
  to: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  timezone: z.string().default("Asia/Dhaka"),
});

export const frequencyCapSchema = z.object({
  enabled: z.boolean().default(false),
  perContact: z.number().int().min(1).max(100).default(1),
  perWindowHours: z.number().int().min(1).max(8760).default(24),
});

export type QuietHoursConfig = z.output<typeof quietHoursSchema>;
export type FrequencyCapConfig = z.output<typeof frequencyCapSchema>;

/**
 * The resolved defaults, as values rather than as `.default({})` on the object
 * schemas above.
 *
 * Zod 4 types `.default()` against the *output* type, so `.default({})` on an
 * object whose output has required keys is a type error — the fallback would
 * have to spell out every field, which defeats the point. Parsing `{}` gives
 * the same result at runtime (each inner field fills its own default) while
 * staying version-agnostic.
 */
export const DEFAULT_QUIET_HOURS: QuietHoursConfig = quietHoursSchema.parse({});
export const DEFAULT_FREQUENCY_CAP: FrequencyCapConfig = frequencyCapSchema.parse({});

export const graphSchema = z.object({
  nodes: z.array(
    z.object({
      id: nonEmpty,
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.string(), z.unknown()).default({}),
    })
  ),
  edges: z.array(
    z.object({
      id: nonEmpty,
      source: nonEmpty,
      target: nonEmpty,
      sourceHandle: z.string().nullish(),
      targetHandle: z.string().nullish(),
    })
  ),
});

/**
 * The three states a rule can be in. Named once here so the builder, the
 * list-page toggle and the database all agree on the spellings.
 */
export const AUTOMATION_STATUSES = ["draft", "active", "paused"] as const;

/**
 * `AutomationRun.status` — the outcome of one rule meeting one event.
 *
 * `matched` and `sent` are deliberately separate: a rule that tags a
 * conversation but sends nothing has matched without replying, and the reply
 * rate on the overview would be wrong if the two were collapsed.
 */
export const RUN_STATUSES = ["matched", "sent", "skipped", "failed", "waiting"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

/** A message was delivered — so this run is also an AI turn that never happened. */
export const RUN_STATUS_SENT: RunStatus = "sent";

/** Payload accepted by `POST` and `PATCH /api/automations`. */
export const automationWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().nullable(),
    chatbotId: z.string().nullable().optional(),
    kind: z.enum(["rule", "flow"]).default("rule"),
    status: z.enum(AUTOMATION_STATUSES).default("draft"),
    priority: z.number().int().min(1).max(10000).default(100),
    stopOnMatch: z.boolean().default(true),
    matchMode: z.enum(["all", "any"]).default("all"),
    trigger: triggerSchema,
    conditions: z.array(conditionSchema).max(20).default([]),
    actions: z.array(actionSchema).max(20).default([]),
    graph: graphSchema.optional().nullable(),
    quietHours: quietHoursSchema.optional(),
    frequencyCap: frequencyCapSchema.optional(),
  })
  .superRefine((rule, ctx) => {
    // A `flow` without a graph would save successfully and then do nothing —
    // the run log would show `matched` with zero actions, which is impossible
    // to diagnose from the UI. Reject it at the edge instead.
    if (rule.kind === "flow" && (!rule.graph || rule.graph.nodes.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["graph"],
        message: "A flow requires at least one node",
      });
    }
    if (rule.kind === "rule" && rule.actions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["actions"],
        message: "A rule requires at least one action",
      });
    }
  });

/**
 * The list page's enable/disable toggle, kept as its own schema rather than
 * derived from `automationWriteSchema`: the write schema is wrapped by a
 * refinement, and reaching through that wrapper to pluck one field differs by
 * zod major version.
 */
export const automationStatusSchema = z.object({
  status: z.enum(AUTOMATION_STATUSES),
});

export type AutomationWriteInput = z.input<typeof automationWriteSchema>;
export type AutomationWriteData = z.output<typeof automationWriteSchema>;

/**
 * Payload accepted by `POST /api/automations/evaluate` (called by n8n).
 *
 * There is deliberately no `mediaType` field. n8n knows the media type — its
 * `Media Router` branches on it — but nothing in the engine evaluates it, and
 * an accepted-but-ignored field reads like a working feature. Zod strips the
 * key, so an older Gate node that still sends it keeps working.
 */
export const evaluateEventSchema = z.object({
  chatbotId: nonEmpty,
  sessionId: nonEmpty,
  channel: z.string().trim().min(1).optional(),
  message: z.string().max(10000).default(""),
  /**
   * Optional on purpose, and the default must not be `false`.
   *
   * n8n has no cheap way to know whether this is the conversation's first
   * message, so it omits the field — and a `false` default would then be
   * indistinguishable from an explicit "not first", permanently disabling the
   * `isFirstMessage` condition and the `conversation.first_message` trigger on
   * the only path that carries real customer messages. Leaving it undefined
   * lets the loader derive it from the stored message count, which is the
   * authoritative answer anyway.
   */
  isFirstMessage: z.boolean().optional(),
  triggerType: z.enum(TRIGGER_TYPES).default("message.received"),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type EvaluateEventInput = z.input<typeof evaluateEventSchema>;
export type EvaluateEventData = z.output<typeof evaluateEventSchema>;

/** Payload accepted by `POST /api/automations/[automationId]/test`. */
export const testRunSchema = z.object({
  message: z.string().trim().min(1).max(10000),
  channel: z.string().trim().min(1).default("facebook"),
  sessionId: z.string().trim().min(1).default("dry-run"),
  isFirstMessage: z.boolean().default(false),
});

// ── Tags ──────────────────────────────────────────────────────────────────────

/**
 * Tag colour is validated as a hex triplet rather than as "any string" because
 * it is interpolated into a `style` attribute on the client. A value like
 * `red; background-image: url(...)` would be a CSS injection, and there is no
 * reason a tag ever needs a colour a colour picker cannot produce.
 */
export const tagWriteSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour")
    .default("#6d28d9"),
});

export type TagWriteData = z.output<typeof tagWriteSchema>;

// ── Message templates ─────────────────────────────────────────────────────────

export const TEMPLATE_CHANNELS = ["all", "facebook", "instagram", "whatsapp", "web"] as const;
export const TEMPLATE_CATEGORIES = ["marketing", "utility", "authentication"] as const;
export const TEMPLATE_HEADER_TYPES = ["none", "text", "image", "video", "document"] as const;

/**
 * WhatsApp approval state. Read-only from the client's point of view — the
 * platform sets it — which is why it appears here as a type but not in
 * `templateWriteSchema`.
 */
export const WA_TEMPLATE_STATUSES = [
  "not_submitted",
  "pending",
  "approved",
  "rejected",
] as const;

export type WaTemplateStatus = (typeof WA_TEMPLATE_STATUSES)[number];

const templateButtonSchema = z.object({
  type: z.enum(["quick_reply", "url", "phone"]).default("quick_reply"),
  label: z.string().trim().min(1).max(25),
  // Absent for a quick reply, which echoes its label back to the flow.
  value: z.string().trim().max(2000).optional(),
});

export const templateWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    channel: z.enum(TEMPLATE_CHANNELS).default("all"),
    category: z.enum(TEMPLATE_CATEGORIES).default("utility"),
    language: z.enum(["bn", "en"]).default("bn"),
    body: z.string().trim().min(1).max(4000),
    headerType: z.enum(TEMPLATE_HEADER_TYPES).default("none"),
    headerValue: z.string().trim().max(2000).optional().nullable(),
    buttons: z.array(templateButtonSchema).max(3).default([]),
    archived: z.boolean().default(false),
  })
  .superRefine((template, ctx) => {
    // A header declared as `image` with nothing to point at renders as an empty
    // bubble on WhatsApp — and is rejected outright on submission. `none` is
    // the honest way to say "no header".
    if (template.headerType !== "none" && !template.headerValue) {
      ctx.addIssue({
        code: "custom",
        path: ["headerValue"],
        message: `A "${template.headerType}" header requires a value`,
      });
    }
    // A URL button without a destination is unclickable.
    for (const [index, button] of template.buttons.entries()) {
      if (button.type !== "quick_reply" && !button.value) {
        ctx.addIssue({
          code: "custom",
          path: ["buttons", index, "value"],
          message: `A "${button.type}" button requires a value`,
        });
      }
    }
  });

export type TemplateWriteData = z.output<typeof templateWriteSchema>;

/**
 * The WhatsApp submission result, as its own payload.
 *
 * V1 has no template-submission API — the merchant submits through Meta's own
 * dashboard and records the outcome here. Keeping it out of
 * `templateWriteSchema` means a create can never declare itself `approved`,
 * while still letting the real status be corrected once Meta answers.
 */
export const templateStatusSchema = z.object({
  waStatus: z.enum(WA_TEMPLATE_STATUSES),
  waTemplateId: z.string().trim().max(200).nullable().optional(),
  waRejectedReason: z.string().trim().max(500).nullable().optional(),
});

// ── Broadcasts ────────────────────────────────────────────────────────────────

/**
 * How a broadcast picks its recipients.
 *
 * Stored as a filter rather than as a frozen list of session ids: a scheduled
 * broadcast that resolves its audience at send time reaches customers who
 * messaged in the meantime, and — more importantly — never messages someone who
 * unsubscribed between scheduling and sending.
 */
export const broadcastAudienceSchema = z.object({
  leadStatus: z.array(z.string().trim().min(1)).max(10).default([]),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  platform: z.array(z.enum(["facebook", "instagram", "whatsapp", "web"])).max(4).default([]),
  /** `null` = no recency filter. */
  lastSeenDays: z.number().int().min(1).max(365).nullable().default(null),
});

export type BroadcastAudience = z.output<typeof broadcastAudienceSchema>;

export const broadcastWriteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chatbotId: z.string().nullable().optional(),
  channel: z.enum(["facebook", "instagram", "whatsapp", "web"]),
  templateId: z.string().nullable().optional(),
  body: z.string().trim().min(1).max(4000),
  // Optional at the schema level rather than `.default({})` — see the note on
  // `DEFAULT_QUIET_HOURS` for why Zod 4 makes that a type error on objects.
  audience: broadcastAudienceSchema.optional(),
  /**
   * An ISO 8601 string. Validated with `Date.parse` rather than a zod date
   * format, whose API moved between zod majors (`z.string().datetime()` →
   * `z.iso.datetime()`).
   */
  scheduledAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Must be an ISO date-time")
    .nullable()
    .optional(),
});

export type BroadcastWriteData = z.output<typeof broadcastWriteSchema>;

/** Broadcast lifecycle. `sending` is set by the sender, never by a request. */
export const BROADCAST_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "failed",
] as const;

export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export const broadcastStatusSchema = z.object({
  status: z.enum(["draft", "scheduled", "paused"]),
});

/** The resolved audience defaults, for the same reason as `DEFAULT_QUIET_HOURS`. */
export const DEFAULT_BROADCAST_AUDIENCE: BroadcastAudience = broadcastAudienceSchema.parse({});

/**
 * Read a stored `Broadcast.audience` column back into a filter.
 *
 * Unlike a rule's JSON, this may legitimately be `{}` — a broadcast saved
 * before its audience was chosen. Parsing fills every field with its default,
 * which is the honest reading of "no filter yet" and keeps the resolver from
 * having to handle a half-populated object.
 */
export function parseBroadcastAudience(raw: unknown): BroadcastAudience {
  const parsed = broadcastAudienceSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_BROADCAST_AUDIENCE;
}
