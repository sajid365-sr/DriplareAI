import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/core/db";
import { runEvent } from "@/lib/automations/run";
import { evaluateEventSchema } from "@/lib/automations/schema";

/**
 * POST /api/automations/evaluate — the runtime engine's HTTP face.
 *
 * Called by n8n's `Automation Gate` node, which sits immediately after the
 * platform trigger in Core-AI-Brain. It answers one question: for this incoming
 * event, should the AI reply, should a rule reply, or should a human take over?
 *
 * Why it exists at all, given the AI pipeline already works: an incoming
 * message used to always cost a full RAG + LLM round trip. When a canned rule
 * matches, the AI Agent is skipped entirely — which is both faster and free.
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
 */

const INTERNAL_HEADER = "x-driplare-internal";

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
    // rather than breaking a live conversation over a missing scope.
    if (!bot?.workspaceId) {
      return continueResponse();
    }

    const run = await runEvent({
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
    });

    return NextResponse.json({
      action: run.action,
      messages: run.messages,
      muteAi: run.muteAi,
      // `continueWithAi` alongside a canned message means "say this, *then* let
      // the AI carry on" — n8n needs the flag to know not to stop after
      // delivering.
      continueWithAi: run.continueWithAi,
      runId: run.runId,
    });
  } catch (error) {
    console.error("[AUTOMATIONS_EVALUATE]", error);
    return continueResponse();
  }
}

function continueResponse() {
  return NextResponse.json({ action: "continue", messages: [], muteAi: false, runId: null });
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

  const provided = req.headers.get(INTERNAL_HEADER);
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // `timingSafeEqual` throws on a length mismatch, which would itself leak the
  // secret's length — compare lengths first and fail flat.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
