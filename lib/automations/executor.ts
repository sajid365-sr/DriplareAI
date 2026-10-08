import "server-only";

import { db } from "@/lib/core/db";
import { appUrl } from "@/lib/services/mail";
import { isPublicHttpUrl, type ActionType, type AutomationAction } from "./schema";
import { renderTemplate, type TemplateVariables } from "./templates";

/**
 * Executes the actions that change state rather than send a message.
 *
 * The split matters: message actions (`send_text`, …) are returned to the
 * caller so n8n delivers them through the channel's own send nodes, while
 * everything here runs in-process against the database. Keeping the two apart
 * means there is exactly one component that talks to Meta's send APIs per
 * path, instead of two that can disagree.
 *
 * No action throws. A failing webhook must not prevent the tag from being
 * applied, and a missing tag must not prevent the merchant notification — so
 * each result is collected and written to the run log, where a merchant can
 * see exactly which step of their rule failed and why.
 */

export interface ExecutionTarget {
  workspaceId: string;
  /** Resolved `Chatbot.chatbotId`. */
  chatbotId: string;
  /** `Chatbot.userId` — the workspace owner, used for notifications. */
  ownerUserId: string;
  sessionId: string;
  /** Template values already resolved by the caller. */
  variables: TemplateVariables;
}

export interface ActionResult {
  type: ActionType;
  ok: boolean;
  detail?: string;
}

const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * A note and a notification both read better with the customer's name in them,
 * so every text-bearing action runs through the same interpolation as a
 * message body.
 */
function fill(text: string | undefined, variables: TemplateVariables): string {
  return text ? renderTemplate(text, variables) : "";
}

async function applyTag(target: ExecutionTarget, tagId: string, add: boolean): Promise<ActionResult["detail"]> {
  // The tag must exist in this workspace. Writing a `SessionTag` for a tag id
  // from another workspace would create a cross-tenant join and leak the tag's
  // name back through the inbox.
  const tag = await db.contactTag.findFirst({
    where: { workspaceId: target.workspaceId, tagId },
    select: { tagId: true },
  });
  if (!tag) return `tag ${tagId} not found in this workspace`;

  if (add) {
    await db.sessionTag.upsert({
      where: {
        chatbotId_sessionId_tagId: {
          chatbotId: target.chatbotId,
          sessionId: target.sessionId,
          tagId,
        },
      },
      create: { chatbotId: target.chatbotId, sessionId: target.sessionId, tagId },
      update: {},
    });
    return undefined;
  }

  await db.sessionTag.deleteMany({
    where: { chatbotId: target.chatbotId, sessionId: target.sessionId, tagId },
  });
  return undefined;
}

async function postWebhook(action: Extract<AutomationAction, { type: "webhook" }>, target: ExecutionTarget) {
  // Re-checked here even though the schema rejected it at save time: a rule
  // stored before this guard existed, or edited directly in the database, must
  // not be able to reach the internal network.
  if (!isPublicHttpUrl(action.url)) {
    return { ok: false, detail: "url is not a public http(s) address" };
  }

  const body = action.bodyTemplate ? fill(action.bodyTemplate, target.variables) : undefined;
  const url = new URL(action.url);
  if (action.method === "GET" && body) {
    url.searchParams.set("payload", body);
  }

  try {
    const response = await fetch(url, {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
        ...action.headers,
      },
      ...(action.method === "POST" && body ? { body } : {}),
      // An unbounded fetch would hang the whole evaluation, and this runs on
      // the message hot path.
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });

    return response.ok
      ? { ok: true }
      : { ok: false, detail: `webhook responded ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return { ok: false, detail: `webhook error: ${message}` };
  }
}

/** Run every side-effect action, in order, collecting one result each. */
export async function executeSideEffects(
  actions: AutomationAction[],
  target: ExecutionTarget
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      results.push(await executeOne(action, target));
    } catch (error) {
      results.push({
        type: action.type,
        ok: false,
        detail: error instanceof Error ? error.message : "unexpected error",
      });
    }
  }

  return results;
}

async function executeOne(
  action: AutomationAction,
  target: ExecutionTarget
): Promise<ActionResult> {
  const ok = (detail?: string): ActionResult => ({ type: action.type, ok: true, detail });
  const fail = (detail: string): ActionResult => ({ type: action.type, ok: false, detail });

  switch (action.type) {
    // ── AI state ──────────────────────────────────────────────────────────────
    case "pause_ai":
    case "handoff_to_human":
    case "close_conversation":
      // `isActive = false` is the existing "a human owns this conversation now"
      // signal — the same one the Live Inbox sets when an agent replies, and
      // the one the AI pipeline already respects. Closing additionally archives
      // so it leaves the active inbox; a human still has to do that by hand.
      await db.chatSession.updateMany({
        where: { chatbotId: target.chatbotId, sessionId: target.sessionId },
        data: {
          isActive: false,
          ...(action.type === "close_conversation" ? { isArchived: true } : {}),
          updatedAt: new Date(),
        },
      });

      if (action.type === "handoff_to_human") {
        await notify(target, {
          type: "system",
          title: "Human handover requested",
          message: action.note
            ? fill(action.note, target.variables)
            : `${target.variables.name || "A customer"} needs a human agent.`,
        });
      }
      return ok();

    case "resume_ai":
      await db.chatSession.updateMany({
        where: { chatbotId: target.chatbotId, sessionId: target.sessionId },
        data: { isActive: true, isArchived: false, updatedAt: new Date() },
      });
      return ok();

    // ── CRM ───────────────────────────────────────────────────────────────────
    case "add_tag":
      return tagResult(action.type, await applyTag(target, action.tagId, true));

    case "remove_tag":
      return tagResult(action.type, await applyTag(target, action.tagId, false));

    case "set_lead_status":
      await db.chatSession.updateMany({
        where: { chatbotId: target.chatbotId, sessionId: target.sessionId },
        data: { leadStatus: action.value, updatedAt: new Date() },
      });
      return ok();

    case "add_note": {
      await db.conversationNote.create({
        data: {
          chatbotId: target.chatbotId,
          sessionId: target.sessionId,
          authorUserId: null,
          source: "automation",
          text: fill(action.text, target.variables),
        },
      });
      return ok();
    }

    // ── Notifications & outbound ──────────────────────────────────────────────
    case "notify_merchant":
      await notify(target, {
        type: "system",
        title: fill(action.title, target.variables),
        message: fill(action.message, target.variables),
      });
      return ok();

    case "send_email": {
      // Imported lazily: `mail.ts` pulls in the Resend SDK and the whole email
      // template set, and most workspaces never use this action. Keeping it
      // out of the module graph means the message hot path does not pay for it.
      const { sendMail } = await import("@/lib/services/mail");
      const result = await sendMail({
        to: fill(action.to, target.variables),
        subject: fill(action.subject, target.variables),
        html: `<p>${escapeHtml(fill(action.body, target.variables))}</p>`,
      });

      // Resend resolves with an error *object*, not a string, so it has to be
      // stringified before it can go into the run log.
      return result.success
        ? ok()
        : fail(`email rejected: ${stringifyError(result.error)}`);
    }

    case "webhook": {
      const result = await postWebhook(action, target);
      return result.ok ? ok() : fail(result.detail ?? "webhook failed");
    }

    // ── Assignment ────────────────────────────────────────────────────────────
    case "assign_to_agent": {
      // V1 has no Team model: every workspace has exactly one operator, its
      // owner. Rather than silently reassigning to somebody who cannot see the
      // conversation, a rule naming a different user is rejected outright — the
      // run log then says so, instead of showing a success nobody can observe.
      if (action.userId && action.userId !== target.ownerUserId) {
        return fail(
          `V1 workspaces have a single operator; "${action.userId}" cannot be assigned`
        );
      }

      await db.chatSession.updateMany({
        where: { chatbotId: target.chatbotId, sessionId: target.sessionId },
        data: { assignedToUserId: target.ownerUserId, updatedAt: new Date() },
      });
      return ok();
    }

    // Message and AI-continuation actions are handled by the caller, not here.
    case "send_text":
    case "send_template":
    case "send_media":
    case "send_quick_replies":
    case "ai_reply":
      return fail(`${action.type} is a delivery action and must not reach the executor`);

    default: {
      // Exhaustiveness guard: adding an action type without handling it here is
      // a compile error, not a silent no-op at runtime.
      const unreachable: never = action;
      return fail(`unhandled action ${JSON.stringify(unreachable)}`);
    }
  }
}

function tagResult(type: ActionType, detail: string | undefined): ActionResult {
  return detail ? { type, ok: false, detail } : { type, ok: true };
}

async function notify(
  target: ExecutionTarget,
  payload: { type: string; title: string; message: string }
): Promise<void> {
  await db.notification.create({
    data: { userId: target.ownerUserId, ...payload },
  });
}

/**
 * `send_email` bodies are plain text from a merchant, but they are interpolated
 * from customer data. Escaping before embedding keeps a customer whose name is
 * `<img onerror=…>` from injecting markup into the merchant's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Vendor errors arrive as objects; the run log needs a line of text. */
function stringifyError(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "unserializable error";
  }
}

/** Absolute link to a conversation, for notification bodies. */
export function conversationUrl(chatbotId: string): string {
  return appUrl(`/dashboard/inbox?chatbotId=${chatbotId}`);
}
