/**
 * Automation engine — the pure evaluator.
 *
 * This module deliberately has **no database access**. It takes the rules, the
 * event, and the resolved facts about the conversation, and answers two
 * questions:
 *
 *   1. Which rules fire, in what order?
 *   2. For every rule that did *not* fire, why not?
 *
 * The second question is the important one. "My automation didn't work" is the
 * single most common support request for any rules engine, and the only honest
 * answer is a per-rule reason. Keeping the evaluator pure is what makes that
 * answer testable — and it means the dry-run preview and the live pipeline run
 * the exact same code path.
 */

import type {
  AutomationAction,
  AutomationCondition,
  ConditionOp,
  FrequencyCapConfig,
  QuietHoursConfig,
  Trigger,
} from "./schema";

// ── Inputs ────────────────────────────────────────────────────────────────────

/** The rule shape the engine needs — a projection of the `Automation` row. */
export interface EngineRule {
  automationId: string;
  name: string;
  kind: string;
  status: string;
  priority: number;
  stopOnMatch: boolean;
  matchMode: "all" | "any";
  trigger: Trigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  quietHours: QuietHoursConfig;
  frequencyCap: FrequencyCapConfig;
}

/**
 * Facts about the conversation, resolved by the caller before evaluation.
 * The engine never queries for these — that is what keeps it pure.
 */
export interface EvaluationContext {
  chatbotId?: string | null;
  channel?: string | null;
  integrationId?: string | null;
  isFirstMessage: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  leadStatus?: string | null;
  sentiment?: string | null;
  /** "bn" | "en" | "banglish" — detected from the incoming text. */
  language?: string | null;
  tagIds: string[];
  orderValue?: number | null;
  minutesSinceLastMessage?: number | null;
  aiActive: boolean;
  /**
   * How many times each automation already fired for this contact, keyed by
   * `automationId`. Per-rule rather than a single number because each rule
   * carries its own window and cap — sharing one count would let a chatty rule
   * silently exhaust a quiet one's allowance.
   */
  recentRunsByRule: Record<string, number>;
  now: Date;
}

export const SKIP_REASONS = [
  "not_active",
  "trigger_mismatch",
  "condition_failed",
  "quiet_hours",
  "frequency_cap",
  "lower_priority",
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export interface RuleOutcome {
  automationId: string;
  name: string;
  matched: boolean;
  skipReason?: SkipReason;
  /** Human-readable detail for `condition_failed`, e.g. `channel is "web"`. */
  detail?: string;
}

export interface EvaluationResult {
  /** What n8n should do next. */
  action: "reply" | "continue" | "handoff";
  winners: EngineRule[];
  outcomes: RuleOutcome[];
  /** Outbound message actions, flattened in rule order, for n8n to deliver. */
  replyActions: AutomationAction[];
  /** Non-message actions for the server to execute in-process. */
  sideEffectActions: AutomationAction[];
  /** True when the AI should stop answering this conversation. */
  muteAi: boolean;
  /**
   * True when a matched rule explicitly asked for `ai_reply` — n8n delivers the
   * canned messages *and* still runs the AI Agent afterwards.
   */
  continueWithAi: boolean;
}

// ── Trigger matching ──────────────────────────────────────────────────────────

export interface TriggerEvent {
  type: Trigger["type"];
  messageText: string;
  /** Trigger-specific extras: order status, tag id, cart value, … */
  payload: Record<string, unknown>;
}

/**
 * A merchant-supplied regex runs on every incoming message, so an accidental
 * catastrophic-backtracking pattern would stall the whole pipeline. Length is
 * capped and compilation failures are swallowed into "no match" — a broken
 * pattern should quietly not fire, not take the endpoint down.
 */
function safeRegexTest(pattern: string, text: string, flags: string): boolean {
  if (pattern.length > 200) return false;
  try {
    return new RegExp(pattern, flags).test(text);
  } catch {
    return false;
  }
}

function keywordMatch(trigger: Trigger & { type: "keyword.match" }, text: string): boolean {
  const haystack = trigger.caseSensitive ? text : text.toLowerCase();
  const flags = trigger.caseSensitive ? "" : "i";

  return trigger.keywords.some((rawKeyword) => {
    const keyword = trigger.caseSensitive ? rawKeyword : rawKeyword.toLowerCase();
    switch (trigger.matchMode) {
      case "exact":
        return haystack.trim() === keyword;
      case "regex":
        return safeRegexTest(rawKeyword, text, flags);
      case "contains":
      default:
        return haystack.includes(keyword);
    }
  });
}

/** Does this rule's trigger fire for this event? */
export function triggerMatches(trigger: Trigger, event: TriggerEvent): boolean {
  if (trigger.type !== event.type) return false;

  switch (trigger.type) {
    case "keyword.match":
      return keywordMatch(trigger, event.messageText);

    case "comment.created":
      // No keywords configured means "every comment".
      if (trigger.keywords.length === 0) return true;
      return trigger.keywords.some((keyword) =>
        event.messageText.toLowerCase().includes(keyword.toLowerCase())
      );

    case "order.status_changed": {
      const status = String(event.payload.status ?? "");
      return trigger.statuses.includes(status as "Processing");
    }

    case "lead.status_changed": {
      const status = String(event.payload.status ?? "");
      return trigger.statuses.includes(status as "high_prospect");
    }

    case "sentiment.changed": {
      const sentiment = String(event.payload.sentiment ?? "");
      return trigger.values.includes(sentiment as "positive");
    }

    case "tag.added": {
      if (!trigger.tagId) return true;
      return String(event.payload.tagId ?? "") === trigger.tagId;
    }

    // The remaining triggers carry no extra configuration — the caller decides
    // whether the event happened at all (e.g. a cron emits `session.idle` only
    // once a conversation really has gone quiet).
    default:
      return true;
  }
}

// ── Condition matching ────────────────────────────────────────────────────────

function readField(field: AutomationCondition["field"], ctx: EvaluationContext): unknown {
  switch (field) {
    case "channel":
      return ctx.channel;
    case "chatbotId":
      return ctx.chatbotId;
    case "integrationId":
      return ctx.integrationId;
    case "isFirstMessage":
      return ctx.isFirstMessage;
    case "hasPhone":
      return ctx.hasPhone;
    case "hasAddress":
      return ctx.hasAddress;
    case "leadStatus":
      return ctx.leadStatus;
    case "sentiment":
      return ctx.sentiment;
    case "language":
      return ctx.language;
    case "orderValue":
      return ctx.orderValue;
    case "minutesSinceLastMessage":
      return ctx.minutesSinceLastMessage;
    case "aiActive":
      return ctx.aiActive;
    // `messageText` and `dayOfWeek` are handled by `compareCondition` because
    // they need the event / clock rather than the context.
    default:
      return undefined;
  }
}

function dayOfWeek(now: Date): string {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    now.getDay()
  ];
}

function compare(op: ConditionOp, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "eq":
      return String(actual) === String(expected);
    case "neq":
      return String(actual) !== String(expected);
    case "in":
      return Array.isArray(expected) && expected.map(String).includes(String(actual));
    case "not_in":
      return Array.isArray(expected) && !expected.map(String).includes(String(actual));
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "regex":
      return safeRegexTest(String(expected ?? ""), String(actual ?? ""), "i");
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

/**
 * Returns `null` when the condition passes, or a short human-readable string
 * describing the actual value when it fails — this string lands in the run log
 * and is what the merchant reads to fix the rule.
 */
export function conditionFails(
  condition: AutomationCondition,
  ctx: EvaluationContext,
  event: TriggerEvent
): string | null {
  // `tagId` is the one field the context stores as a set, so `eq`/`in` have to
  // be interpreted as membership rather than as a scalar comparison.
  if (condition.field === "tagId") {
    const expected = Array.isArray(condition.value)
      ? condition.value.map(String)
      : [String(condition.value)];
    const has = condition.op === "neq" || condition.op === "not_in"
      ? !expected.some((tag) => ctx.tagIds.includes(tag))
      : expected.some((tag) => ctx.tagIds.includes(tag));
    return has ? null : `tags do not match (${ctx.tagIds.length} tag(s) on this contact)`;
  }

  const actual =
    condition.field === "messageText"
      ? event.messageText
      : condition.field === "dayOfWeek"
        ? dayOfWeek(ctx.now)
        : readField(condition.field, ctx);

  if (compare(condition.op, actual, condition.value)) return null;

  return `${condition.field} ${condition.op} ${JSON.stringify(condition.value)} (actual: ${JSON.stringify(actual)})`;
}

// ── Guard rails ───────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Is `now` inside the rule's quiet window? Windows that wrap past midnight
 * (22:00 → 08:00) are the common case, so the comparison has to branch on
 * `from > to` rather than assume a same-day range.
 *
 * The timezone conversion uses the runtime's `Intl` support rather than a date
 * library: it is exact for the IANA zones merchants pick, and it keeps this
 * module dependency-free so it stays trivially testable.
 */
export function isQuietHours(config: QuietHoursConfig, now: Date): boolean {
  if (!config.enabled) return false;

  let localHours: number;
  let localMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: config.timezone || "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    localHours = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    localMinutes = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  } catch {
    // An unknown timezone string throws — treating it as "not quiet" is the
    // safe direction: a misconfigured timezone should not silence a rule.
    return false;
  }

  const current = localHours * 60 + localMinutes;
  const from = toMinutes(config.from);
  const to = toMinutes(config.to);

  return from <= to ? current >= from && current < to : current >= from || current < to;
}

// ── The evaluator ─────────────────────────────────────────────────────────────

/**
 * Evaluate every rule against one event.
 *
 * Ordering: rules run lowest `priority` first. A matched rule that sets
 * `stopOnMatch` ends evaluation, and everything after it is reported as
 * `lower_priority` — so the merchant can see that a rule did not fire because
 * an earlier one already handled the message, which is otherwise invisible.
 */
export function evaluate(
  rules: EngineRule[],
  event: TriggerEvent,
  ctx: EvaluationContext
): EvaluationResult {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  const outcomes: RuleOutcome[] = [];
  const winners: EngineRule[] = [];
  let stopped = false;

  for (const rule of ordered) {
    if (stopped) {
      outcomes.push({
        automationId: rule.automationId,
        name: rule.name,
        matched: false,
        skipReason: "lower_priority",
      });
      continue;
    }

    const skip = (skipReason: SkipReason, detail?: string) =>
      outcomes.push({ automationId: rule.automationId, name: rule.name, matched: false, skipReason, detail });

    if (rule.status !== "active") {
      skip("not_active");
      continue;
    }

    if (!triggerMatches(rule.trigger, event)) {
      skip("trigger_mismatch");
      continue;
    }

    // `matchMode: "any"` needs an empty condition list to mean "match", which
    // falls out of `some` on an empty array returning false — so handle it
    // explicitly rather than shipping a rule that can never fire.
    const conditionResults = rule.conditions.map((c) => conditionFails(c, ctx, event));
    const allPassed = conditionResults.every((r) => r === null);
    const anyPassed = rule.conditions.length === 0 || conditionResults.some((r) => r === null);
    const passed = rule.matchMode === "any" ? anyPassed : allPassed;

    if (!passed) {
      const firstFailure = conditionResults.find((r) => r !== null) ?? undefined;
      skip("condition_failed", firstFailure);
      continue;
    }

    if (isQuietHours(rule.quietHours, ctx.now)) {
      skip("quiet_hours");
      continue;
    }

    const recentRuns = ctx.recentRunsByRule[rule.automationId] ?? 0;
    if (rule.frequencyCap.enabled && recentRuns >= rule.frequencyCap.perContact) {
      skip("frequency_cap", `already sent ${recentRuns} time(s) in the window`);
      continue;
    }

    outcomes.push({
      automationId: rule.automationId,
      name: rule.name,
      matched: true,
    });
    winners.push(rule);

    if (rule.stopOnMatch) {
      stopped = true;
    }
  }

  const replyActions: AutomationAction[] = [];
  const sideEffectActions: AutomationAction[] = [];
  let muteAi = false;
  let wantsAi = false;

  for (const rule of winners) {
    for (const action of rule.actions) {
      switch (action.type) {
        case "send_text":
        case "send_template":
        case "send_media":
        case "send_quick_replies":
          replyActions.push(action);
          break;
        case "ai_reply":
          wantsAi = true;
          break;
        case "pause_ai":
          muteAi = true;
          break;
        case "handoff_to_human":
          if (action.muteAi) muteAi = true;
          sideEffectActions.push(action);
          break;
        default:
          sideEffectActions.push(action);
      }
    }
  }

  // A rule can legitimately fire without sending anything (tag it, note it,
  // notify the merchant). In that case the AI still answers — otherwise adding
  // a tag would silently swallow the customer's message.
  const action: EvaluationResult["action"] = muteAi
    ? "handoff"
    : replyActions.length > 0
      ? "reply"
      : "continue";

  // `ai_reply` is the default outcome, so it only carries information when a
  // rule also sends a canned message: "say this, *then* let the AI continue".
  // Without this flag n8n would deliver the canned reply and skip the agent,
  // and the merchant's second action would be dropped without explanation.
  const continueWithAi = wantsAi;

  return {
    action,
    winners,
    outcomes,
    replyActions,
    sideEffectActions,
    muteAi,
    continueWithAi,
  };
}
