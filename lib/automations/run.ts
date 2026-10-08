import "server-only";

import { db } from "@/lib/core/db";
import { evaluate, type EvaluationContext, type EvaluationResult } from "./engine";
import { executeSideEffects, type ActionResult } from "./executor";
import {
  applyFrequencyCaps,
  buildEvaluationContext,
  loadEngineRules,
  recordRun,
  touchAutomationStats,
} from "./loader";
import type { AutomationAction, TriggerType } from "./schema";
import { renderTemplate, type TemplateVariables } from "./templates";
import {
  deliverOutbound,
  isOutboundPlatform,
  type OutboundMessage,
  type OutboundSkipReason,
} from "@/lib/services/outbound";

/**
 * Run the automation engine for one event.
 *
 * This is the single implementation of "an event happened, now what?". Both
 * callers funnel through it, so a rule cannot behave differently depending on
 * which path reached it:
 *
 *   - `POST /api/automations/evaluate` — called by n8n's `Automation Gate` for
 *     incoming messages. n8n does the delivery (`deliver: false`), because its
 *     per-channel `Send …` nodes already own that.
 *   - `POST /api/cron/run-automations` — time-based triggers (`session.idle`,
 *     `cart.abandoned`). There is no n8n workflow behind these, so this module
 *     delivers through `lib/services/outbound.ts` (`deliver: true`).
 *
 * Duplicating the policy half — the human-takeover check, the AI-disabled
 * check, the reply/handoff decision — across two routes is how the two paths
 * would drift apart within a month.
 */

export interface RunEventInput {
  workspaceId: string;
  chatbotId: string;
  /** `Chatbot.userId` — the only principal a workspace has in V1. */
  ownerUserId: string;
  sessionId: string;
  messageText: string;
  channel?: string | null;
  triggerType: TriggerType;
  payload?: Record<string, unknown>;
  isFirstMessage?: boolean;
  /** Send the replies ourselves instead of handing them to n8n. */
  deliver: boolean;
  now?: Date;
}

export interface DeliveredMessage extends OutboundMessage {
  delivered?: boolean;
  skipReason?: OutboundSkipReason;
  error?: string;
}

export interface RunEventResult {
  action: "reply" | "continue" | "handoff";
  /** Rendered outbound messages, in rule order. */
  messages: OutboundMessage[];
  /** Per-message delivery outcome — only populated when `deliver` is true. */
  delivery: DeliveredMessage[];
  muteAi: boolean;
  continueWithAi: boolean;
  /** True when canned replies existed but a human owns the conversation. */
  suppressedByHuman: boolean;
  sideEffects: ActionResult[];
  runId: string | null;
  /** The engine's raw verdict, for the run log and the dry-run UI. */
  evaluation: EvaluationResult;
  context: EvaluationContext;
}

export async function runEvent(input: RunEventInput): Promise<RunEventResult> {
  const now = input.now ?? new Date();

  const rules = await loadEngineRules({
    workspaceId: input.workspaceId,
    chatbotId: input.chatbotId,
  });

  const ctx = await buildEvaluationContext({
    workspaceId: input.workspaceId,
    chatbotId: input.chatbotId,
    sessionId: input.sessionId,
    messageText: input.messageText,
    channel: input.channel ?? null,
    isFirstMessage: input.isFirstMessage,
    now,
  });

  if (rules.length === 0) {
    return emptyResult(ctx, now);
  }

  const integration = await db.integration.findFirst({
    where: { chatbotId: input.chatbotId },
    select: { config: true },
  });
  const integrationConfig = (integration?.config ?? {}) as Record<string, unknown>;

  await applyFrequencyCaps(ctx, rules, {
    chatbotId: input.chatbotId,
    sessionId: input.sessionId,
  });

  const evaluation = evaluate(
    rules,
    { type: input.triggerType, messageText: input.messageText, payload: input.payload ?? {} },
    ctx
  );

  // ── Policy: who is allowed to speak right now ─────────────────────────────
  // Two pieces of channel configuration written by the Platforms page and read
  // by nothing else; this is where they finally take effect.
  //
  //   - `isActive === false` means a human owns this conversation. A rule must
  //     not talk over them, so automated replies are suppressed — but side
  //     effects (tagging, notifying) still run, because those help the agent
  //     rather than the customer.
  //   - `directMessagingAiEnabled === false` means the merchant switched the AI
  //     off for direct messages. Canned rules are the deliberate replacement,
  //     so they still fire; the AI simply never gets a turn.
  const humanOwnsConversation = !ctx.aiActive;
  const aiDisabledForDms = integrationConfig.directMessagingAiEnabled === false;

  const replyActions = humanOwnsConversation ? [] : evaluation.replyActions;
  const suppressedByHuman = humanOwnsConversation && evaluation.replyActions.length > 0;
  const muteAi = evaluation.muteAi || aiDisabledForDms;

  const variables = buildVariables(input);
  const messages = replyActions.flatMap((action) => renderActions(action, variables));

  const sideEffects = await executeSideEffects(evaluation.sideEffectActions, {
    workspaceId: input.workspaceId,
    chatbotId: input.chatbotId,
    ownerUserId: input.ownerUserId,
    sessionId: input.sessionId,
    variables,
  });

  const action: RunEventResult["action"] =
    messages.length > 0 ? "reply" : muteAi ? "handoff" : "continue";

  const delivery = input.deliver
    ? await deliverAll(input, messages, ctx, now)
    : [];

  // The conversation is only written back when something was actually said to
  // the customer. A rule that merely tags does not get to author a turn.
  if (action === "reply") {
    await persistTurn({
      chatbotId: input.chatbotId,
      ownerUserId: input.ownerUserId,
      sessionId: input.sessionId,
      userMessage: input.messageText,
      replies: messages.map((message) => message.text ?? "").filter(Boolean),
    });
  }

  const runId = await recordRun({
    workspaceId: input.workspaceId,
    chatbotId: input.chatbotId,
    sessionId: input.sessionId,
    triggerType: input.triggerType,
    status: messages.length > 0 ? "sent" : sideEffects.length > 0 ? "matched" : "skipped",
    // `suppressedByHuman` is the one skip reason the engine cannot know about,
    // because it depends on channel policy rather than on the rule.
    skipReason: suppressedByHuman ? "ai_muted" : null,
    matchedRules: evaluation.outcomes,
    actionsResult: [...sideEffects, ...delivery],
  });

  await touchAutomationStats(
    evaluation.winners.map((rule) => rule.automationId),
    now
  );

  return {
    action,
    messages,
    delivery,
    muteAi,
    continueWithAi: evaluation.continueWithAi,
    suppressedByHuman,
    sideEffects,
    runId,
    evaluation,
    context: ctx,
  };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function emptyResult(ctx: EvaluationContext, now: Date): RunEventResult {
  return {
    action: "continue",
    messages: [],
    delivery: [],
    muteAi: false,
    continueWithAi: false,
    suppressedByHuman: false,
    sideEffects: [],
    runId: null,
    evaluation: {
      action: "continue",
      winners: [],
      outcomes: [],
      replyActions: [],
      sideEffectActions: [],
      muteAi: false,
      continueWithAi: false,
    },
    context: { ...ctx, now },
  };
}

/**
 * Deliver each rendered message through the channel layer.
 *
 * Only the time-based path uses this. Delivery failures are returned rather
 * than thrown: one unreachable contact must not abort the rest of the batch.
 */
async function deliverAll(
  input: RunEventInput,
  messages: OutboundMessage[],
  ctx: EvaluationContext & { lastInboundAt: Date | null },
  now: Date
): Promise<DeliveredMessage[]> {
  if (messages.length === 0) return [];

  const channel = ctx.channel ?? input.channel ?? null;
  if (!channel || !isOutboundPlatform(channel)) return [];

  const integration = await db.integration.findFirst({
    where: { chatbotId: input.chatbotId, platform: channel },
    select: { config: true },
  });

  const config = (integration?.config ?? {}) as Record<string, unknown>;
  const results: DeliveredMessage[] = [];

  for (const message of messages) {
    const outcome = await deliverOutbound(
      {
        platform: channel,
        sessionId: input.sessionId,
        config,
        lastInboundAt: ctx.lastInboundAt,
      },
      message,
      now
    );

    results.push({
      ...message,
      delivered: outcome.delivered,
      skipReason: outcome.skipReason,
      error: outcome.error,
    });
  }

  return results;
}

/** Turn one action into the wire shape a channel can deliver. */
export function renderActions(
  action: AutomationAction,
  variables: TemplateVariables
): OutboundMessage[] {
  switch (action.type) {
    case "send_text":
      return [{ text: renderTemplate(action.body, variables) }];
    case "send_media":
      return [
        {
          text: action.caption ? renderTemplate(action.caption, variables) : undefined,
          mediaUrl: action.mediaUrl,
          mediaType: action.mediaType,
        },
      ];
    case "send_quick_replies":
      return [
        {
          text: renderTemplate(action.body, variables),
          quickReplies: action.buttons.map((button) => ({
            label: button.label,
            payload: button.payload,
          })),
        },
      ];
    case "send_template":
      // The template body is resolved from `MessageTemplate` at delivery time;
      // a WhatsApp template must go out as an approved template, not as text.
      // Until that is wired into `outbound.ts`, the action is reported as an
      // explicit unsupported type rather than silently sending nothing.
      return [{ text: `[template:${action.templateId}]` }];
    default:
      return [];
  }
}

/** Template variables from the event payload, plus the conversation's own data. */
export function buildVariables(input: {
  payload?: Record<string, unknown>;
}): TemplateVariables {
  const payload = input.payload ?? {};
  const asString = (key: string): string | null => {
    const value = payload[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : null;
  };

  return {
    name: asString("customerName"),
    phone: asString("phone"),
    address: asString("address"),
    district: asString("district"),
    orderId: asString("orderId"),
    orderTotal: asString("orderTotal"),
    product: asString("product"),
    pageName: asString("pageName"),
    agentName: asString("agentName"),
  };
}

/**
 * Write the customer's message and the canned replies into `ChatMessage`.
 *
 * On the n8n path this is load-bearing: `Save Chat History` runs *after* the AI
 * Agent, so a Gate that short-circuits the agent would leave the conversation
 * missing from the Live Inbox. The two paths are mutually exclusive, so the
 * turn is written exactly once either way.
 *
 * Attributed to the chatbot's owner because `ChatMessage.userId` is required
 * and there is no other principal to name. `sentByHuman` stays false: the AI
 * was bypassed, but the merchant did not type this, and the Live Inbox uses
 * that flag to distinguish an agent's own replies.
 */
export async function persistTurn(input: {
  chatbotId: string;
  ownerUserId: string;
  sessionId: string;
  userMessage: string;
  replies: string[];
}): Promise<void> {
  const now = Date.now();

  const rows = [
    ...(input.userMessage
      ? [
          {
            chatbotId: input.chatbotId,
            userId: input.ownerUserId,
            sessionId: input.sessionId,
            role: "user",
            content: input.userMessage,
            sentByHuman: false,
            // Backdated a second so the user message sorts before the replies
            // that answered it, without needing a sequence column.
            timestamp: new Date(now - 1000),
          },
        ]
      : []),
    ...input.replies.map((reply) => ({
      chatbotId: input.chatbotId,
      userId: input.ownerUserId,
      sessionId: input.sessionId,
      role: "assistant",
      content: reply,
      sentByHuman: false,
      timestamp: new Date(now),
    })),
  ];

  if (rows.length === 0) return;

  await db.$transaction([
    db.chatMessage.createMany({ data: rows }),
    db.chatSession.updateMany({
      where: { chatbotId: input.chatbotId, sessionId: input.sessionId },
      data: {
        lastMessage: input.replies[input.replies.length - 1]?.slice(0, 500) ?? input.userMessage,
        updatedAt: new Date(),
      },
    }),
  ]);
}
