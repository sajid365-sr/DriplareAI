import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { timingSafeEqualString } from "@/lib/core/timing-safe";
import { runEvent } from "@/lib/automations/run";
import { evaluateEventSchema } from "@/lib/automations/schema";
import { QUOTA_REPLY_TEXT, failOpenAnswer, resolveQuotaAnswer, type QuotaAnswer } from "@/lib/ai/quota-answer";

/**
 * POST /api/automations/evaluate — the runtime engine's HTTP face.
 *
 * Called by n8n's `Automation Gate` node, which sits immediately after the
 * platform trigger in Core-AI-Brain. It answers **two** questions for this
 * incoming message, and n8n reads both out of the one response:
 *
 *   1. Should the AI reply, should a rule reply, or should a human take over?
 *      (the automation engine)
 *   2. May this merchant afford an AI call at all? (the credit quota guard)
 *
 * Why the first one exists at all, given the AI pipeline already works: an
 * incoming message used to always cost a full RAG + LLM round trip. When a
 * canned rule matches, the AI Agent is skipped entirely — which is both faster
 * and free.
 *
 * ── Why the second question lives here (TASK-11) ──────────────────────────────
 * n8n used to ask it in a separate `Quota Check` node against
 * `/api/internal/ai-quota`. n8n runs in Bangladesh and the platform on Vercel
 * with its database in Singapore, so every extra node was another pair of
 * intercontinental round trips on the path between a customer's message and
 * their answer. The two questions are independent reads, so asking them
 * together costs no wall-clock time — the quota guard's two queries disappear
 * under the engine's eight — and it removes a whole hop.
 *
 * `/api/internal/ai-quota` still exists and still answers the same question the
 * same way, so the change is reversible by putting n8n's node back. Both go
 * through `resolveQuotaAnswer()` so they can never disagree.
 *
 * Three deliberate choices live in this file rather than in the engine:
 *
 *   - **Shared-secret auth, not a session.** n8n is a server, so the workspace
 *     cannot come from a cookie; it is resolved from the `chatbotId` in the
 *     payload and everything downstream is scoped to it.
 *   - **Delivery is not done here.** The response tells n8n what to send and
 *     n8n's own `Send …` nodes deliver it, so a customer message has exactly
 *     one sender per path. The engine does write the conversation back, though:
 *     n8n's `Save Chat History` runs *after* the AI Agent, so a short-circuited
 *     reply would otherwise never reach the Live Inbox.
 *   - **It fails open.** A transient database error returns `continue`, which
 *     degrades to today's behaviour. Failing closed would mute the AI and
 *     silently stop answering customers.
 *
 *     ⚠️ Failing open applies to the **engine's** answer only. The quota verdict
 *        is not allowed to be lost along with it: an empty balance must still
 *        stop the AI even when the engine itself is broken. The two failures are
 *        caught separately below for exactly that reason.
 */

const INTERNAL_HEADER = "x-driplare-internal";

/**
 * The engine's "nothing to do" verdict — the shape n8n has always received.
 * Kept as one constant so the fail-open paths cannot drift apart.
 */
const CONTINUE_VERDICT = {
  action: "continue",
  messages: [],
  muteAi: false,
  continueWithAi: false,
  runId: null,
} as const;

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = evaluateEventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const event = parsed.data;

    const bot = await db.chatbot.findFirst({
      where: { chatbotId: event.chatbotId },
      select: { chatbotId: true, userId: true, workspaceId: true },
    });

    // A chatbot with no workspace is a legacy row that predates workspaces and
    // has no rules to evaluate — answering `continue` keeps the AI working
    // rather than breaking a live conversation over a missing scope. There is
    // nobody to read a balance for either, so the quota answer says so rather
    // than pretending it checked.
    if (!bot?.workspaceId) {
      return continueResponse(failOpenAnswer("no_target"));
    }

    const [run, quota] = await Promise.all([
      // Caught here, not by the outer handler: see the note on failing open in
      // the header. Without this, an engine error would take the quota verdict
      // down with it and let an out-of-credits merchant keep spending.
      runEvent({
        workspaceId: bot.workspaceId,
        chatbotId: bot.chatbotId,
        ownerUserId: bot.userId,
        sessionId: event.sessionId,
        messageText: event.message,
        channel: event.channel ?? null,
        triggerType: event.triggerType,
        payload: event.payload,
        isFirstMessage: event.isFirstMessage,
        // n8n delivers. See the note above.
        deliver: false,
      }).catch((error) => {
        console.error("[AUTOMATIONS_EVALUATE] engine failed, carrying on", error);
        return null;
      }),

      // `userId` and `workspaceId` come from the lookup above rather than the
      // request body. `assertAIQuota` reads the chatbot owner itself when they
      // are missing, so passing them also saves a query — but the real reason is
      // that a caller should never get to name whose credits are spent.
      resolveQuotaAnswer({
        task: "chat",
        userId: bot.userId,
        workspaceId: bot.workspaceId,
        chatbotId: bot.chatbotId,
        modelId: event.modelId,
        isTestChat: event.channel === "playground",
        isFreeMessage: false,
      }),
    ]);

    let isBlocked = run?.context?.isAiBlocked;
    if (isBlocked === undefined && event.sessionId) {
      const s = await db.chatSession.findFirst({ where: { chatbotId: bot.chatbotId, sessionId: event.sessionId }, select: { isAiBlocked: true } });
      isBlocked = s?.isAiBlocked ?? false;
    }
    const effectiveQuota = isBlocked ? { allowed: false, reason: "ai_blocked" as const, replyText: QUOTA_REPLY_TEXT } : quota;
    if (!run) {
      return continueResponse(effectiveQuota);
    }

    return NextResponse.json({
      action: run.action,
      messages: run.messages,
      muteAi: run.muteAi || Boolean(isBlocked),
      // `continueWithAi` alongside a canned message means "say this, *then* let
      // the AI carry on" — n8n needs the flag to know not to stop after
      // delivering.
      continueWithAi: isBlocked ? false : run.continueWithAi,
      isAiBlocked: Boolean(isBlocked),
      runId: run.runId,
      /**
       * Additive, so a Gate node that predates the merge keeps working.
       *
       * n8n's `Quota Allowed?` reads `allowed !== false`, which is why the
       * absence of this field fails **open** — the same rule the standalone
       * route has always had, kept deliberately so a version skew degrades to
       * "answer the customer" rather than "say nothing".
       */
      quota: effectiveQuota,
    });
  } catch (error) {
    console.error("[AUTOMATIONS_EVALUATE]", error);
    return continueResponse(failOpenAnswer("error"));
  }
}

function continueResponse(quota: QuotaAnswer) {
  return NextResponse.json({ ...CONTINUE_VERDICT, quota });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const expected = process.env.AUTOMATION_INTERNAL_SECRET;
  if (!expected) {
    // With no secret configured the endpoint stays shut rather than open: an
    // unauthenticated endpoint that can send messages on a merchant's behalf is
    // worse than an automation that does not run.
    console.error("[AUTOMATIONS_EVALUATE] AUTOMATION_INTERNAL_SECRET is not set");
    return false;
  }

  return timingSafeEqualString(req.headers.get(INTERNAL_HEADER), expected);
}
