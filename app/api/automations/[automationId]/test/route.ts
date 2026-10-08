import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { evaluate } from "@/lib/automations/engine";
import { buildEvaluationContext, loadEngineRules } from "@/lib/automations/loader";
import { testRunSchema, type AutomationAction } from "@/lib/automations/schema";
import { renderTemplate, type TemplateVariables } from "@/lib/automations/templates";

/**
 * POST /api/automations/[automationId]/test — dry run.
 *
 * "My automation didn't fire" is unanswerable from the rule editor alone, so
 * this runs the *real* engine against a sample message and returns the full
 * per-rule verdict: which rule matched, and for every rule that did not, the
 * reason and the actual value that failed the condition.
 *
 * Two properties make it trustworthy as a preview:
 *
 *  - it calls the same `evaluate()` the runtime path calls, so a rule cannot
 *    pass here and fail in production;
 *  - it writes nothing. No `AutomationRun`, no tags, no messages, no webhooks.
 *    A preview that mutates state stops being a preview.
 */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const target = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
      select: { automationId: true, chatbotId: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = testRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const sample = parsed.data;
    const workspaceBots = target.chatbotId ? [target.chatbotId] : scope.chatbotIds;
    const chatbotId = workspaceBots[0];

    if (!chatbotId) {
      return NextResponse.json(
        { error: "Connect an AI Agent before testing automations" },
        { status: 400 }
      );
    }

    // Drafts and paused rules are included: the whole point of testing a rule
    // the merchant is still writing is to see that it *would* fire.
    const rules = await loadEngineRules({
      workspaceId: scope.workspaceId,
      chatbotId,
      includeInactive: true,
    });

    const ctx = await buildEvaluationContext({
      workspaceId: scope.workspaceId,
      chatbotId,
      // A real session, when the tester picked one, so conditions on lead
      // status, tags and order value report the truth. Otherwise a synthetic
      // id resolves to "nothing is known", which is honest — those conditions
      // then report the actual (missing) value rather than a guess.
      sessionId: sample.sessionId,
      messageText: sample.message,
      channel: sample.channel,
      isFirstMessage: sample.isFirstMessage,
    });

    const outcome = evaluate(
      rules,
      { type: "keyword.match", messageText: sample.message, payload: {} },
      // Frequency caps are neutralised in a preview: told "skipped, already
      // sent 1 time", a merchant would go hunting for a delivery problem that
      // does not exist. Quiet hours still apply, because those are a property
      // of the clock rather than of history, and a merchant testing at 23:00
      // needs to be told the rule is asleep.
      { ...ctx, recentRunsByRule: {} }
    );

    // The runtime applies two channel-level overrides on top of the engine's
    // verdict — a human owning the conversation silences reply actions, and
    // `directMessagingAiEnabled === false` mutes the AI. Previewing the raw
    // engine output instead would let a rule "pass" in the tester and then
    // deliver nothing in production, which is exactly the failure the dry run
    // exists to prevent.
    const integration = await db.integration.findFirst({
      where: { chatbotId },
      select: { config: true },
    });
    const config = (integration?.config ?? {}) as Record<string, unknown>;

    const humanOwnsConversation = !ctx.aiActive;
    const muteAi = outcome.muteAi || config.directMessagingAiEnabled === false;
    const replyActions = humanOwnsConversation ? [] : outcome.replyActions;
    const suppressedByHuman = humanOwnsConversation && outcome.replyActions.length > 0;

    const variables: TemplateVariables = { name: "Customer" };
    const templateNames = await loadTemplateNames(
      scope.workspaceId,
      replyActions.filter((action) => action.type === "send_template").map((a) => a.templateId)
    );
    const messages = replyActions.map((action) => renderPreview(action, variables, templateNames));

    return NextResponse.json({
      evaluatedAt: ctx.now.toISOString(),
      // The rule the merchant is editing, whether or not it won.
      targetMatched: outcome.winners.some((rule) => rule.automationId === automationId),
      winners: outcome.winners.map((rule) => ({
        automationId: rule.automationId,
        name: rule.name,
      })),
      outcomes: outcome.outcomes,
      // Derived exactly as `/api/automations/evaluate` derives it, so the
      // tester cannot promise a reply the runtime would not send.
      action: messages.length > 0 ? "reply" : muteAi ? "handoff" : "continue",
      messages,
      // Split so the UI can say *why* the AI would stay silent: a rule asked
      // for it, or the channel setting did.
      muteAi,
      mutedByRule: outcome.muteAi,
      continueWithAi: outcome.continueWithAi,
      suppressedByHuman,
      humanOwnsConversation,
    });
  } catch (error) {
    console.error("[AUTOMATION_TEST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── Preview rendering ─────────────────────────────────────────────────────────

/**
 * Resolve `send_template` actions to the template's own name, so the preview
 * shows which message would go out rather than an opaque id. The body is not
 * inlined because the delivered text comes from the approved WhatsApp template,
 * not from this row.
 */
async function loadTemplateNames(
  workspaceId: string,
  templateIds: string[]
): Promise<Map<string, string>> {
  if (templateIds.length === 0) return new Map();

  const rows = await db.messageTemplate.findMany({
    where: { workspaceId, templateId: { in: templateIds } },
    select: { templateId: true, name: true },
  });
  return new Map(rows.map((row) => [row.templateId, row.name]));
}

/** One action, rendered the way the customer would receive it. */
function renderPreview(
  action: AutomationAction,
  variables: TemplateVariables,
  templateNames: Map<string, string>
): { type: string; body: string | null; mediaUrl?: string; buttons?: string[] } {
  switch (action.type) {
    case "send_text":
      return { type: "text", body: renderTemplate(action.body, variables) };
    case "send_media":
      return {
        type: "media",
        body: action.caption ? renderTemplate(action.caption, variables) : null,
        mediaUrl: action.mediaUrl,
      };
    case "send_quick_replies":
      return {
        type: "quick_replies",
        body: renderTemplate(action.body, variables),
        buttons: action.buttons.map((button) => button.label),
      };
    case "send_template":
      return { type: "template", body: templateNames.get(action.templateId) ?? action.templateId };
    default:
      // Unreachable while `replyActions` only holds send-type actions, but the
      // switch must still return something rather than fall off the end.
      return { type: action.type, body: null };
  }
}
