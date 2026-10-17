import { NextResponse } from "next/server";
import { z } from "zod";

import { chargeUsage } from "@/lib/ai/charge-usage";
import { resolveModelConfig, resolveModelForPlan } from "@/lib/ai/chat-models";
import { compilePrompt } from "@/lib/ai/prompt-assembler";
import { resolveQuotaAnswer } from "@/lib/ai/quota-answer";
import { db } from "@/lib/core/db";
import type { Region } from "@/lib/core/region";
import { pickWidgetLanguage } from "@/lib/domain/widget-copy";
import { parseWidgetKey } from "@/lib/domain/widget-key";
import {
  WIDGET_IP_RULE,
  WIDGET_SESSION_RULE,
  checkRateLimit,
  clientAddress,
} from "@/lib/widget/rate-limit";

/**
 * `POST /api/widget/<key>` — one turn of a conversation with an embedded agent.
 *
 * ## How this differs from the Playground route it is modelled on
 *
 * `app/api/chatbots/[chatbotId]/chat/route.ts` is the closest sibling and the
 * shape is deliberately the same — resolve the agent, resolve the model the
 * plan allows, ask the quota guard, forward to n8n, bill. Everything that
 * differs, differs because **the caller is a stranger on the merchant's
 * website**, not the merchant:
 *
 * | | Playground | Widget |
 * |---|---|---|
 * | Identity | Clerk session + ownership check | the widget key alone |
 * | Whose credits | the merchant testing | the merchant's, spent on a customer |
 * | `isTestChat` | `true` | **`false`** |
 * | Plan blocked | `403`, merchant told to upgrade | silently clamped to Fast |
 * | Out of credits | `402` to the merchant | a polite sentence to the visitor |
 * | Origin | same-origin | **cross-origin — needs CORS** |
 *
 * ## Why `isTestChat: false` matters
 *
 * `resolveReplyCredits` multiplies by an admin-configured test-chat multiplier.
 * The Playground passes `true` because the merchant is trying their own bot out.
 * A visitor here is a real customer who happens to be the merchant's, so the
 * test discount must not apply — otherwise every real conversation would be
 * billed at the discounted rate and the platform would quietly under-charge for
 * the traffic that actually matters.
 *
 * ## Billing runs here, not in n8n
 *
 * Same reasoning as the Playground: this route made the call and n8n returns the
 * token counts in its reply, so it can bill immediately instead of waiting for a
 * callback that cannot reach a developer's `localhost`. Double-charging is
 * prevented by `billingOk`, exactly as there — see `lib/ai/charge-usage.ts`.
 */

/**
 * Message ceiling, mirrored by `MAX_LENGTH` in the served widget script.
 *
 * The client-side cap is a courtesy so the visitor is told before they type;
 * this one is the actual limit, because the client is not the only way in.
 */
const MAX_MESSAGE_LENGTH = 2000;

const widgetTurnSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  sessionId: z.string().trim().min(1).max(120).default("default"),
  /** The visitor's language, used only to pick which refusal sentence to send. */
  lang: z.string().trim().max(16).optional(),
});

/**
 * The widget is served from our origin but runs on the merchant's, so every
 * call it makes is cross-origin.
 *
 * `*` rather than an allow-list, and that is the direct consequence of
 * addressing the widget by a key instead of by `Origin`: a merchant may embed
 * on several domains, a staging copy and a CMS preview, and keeping that list
 * current would break a working widget every time a merchant added a
 * subdomain. The check that matters lives in the URL.
 *
 * ⚠️ `Access-Control-Allow-Credentials` is deliberately absent and must stay
 *    absent. Without credentials, `*` grants a third-party page nothing it
 *    could not do with `curl` — the key is already in that page's HTML. Adding
 *    credentials would let any site ride a logged-in merchant's session, which
 *    is the one thing `*` must never be combined with.
 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // The preflight is identical for every message; caching it keeps a chatty
  // conversation from paying for an extra round trip per turn.
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

/** The browser asks before it posts. Answering is what makes the chat work at all. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key: rawKey } = await params;
  const widgetKey = parseWidgetKey(rawKey);

  if (!widgetKey) {
    return json({ error: "not_found" }, 404);
  }

  try {
    // ── 1. Rate limit, before anything is read or spent ────────────────────
    // Best-effort and per-instance — `lib/widget/rate-limit.ts` says plainly
    // what it does and does not cover. The durable ceiling is the merchant's
    // balance, checked in step 4.
    const ipVerdict = checkRateLimit(`ip:${clientAddress(req.headers)}`, WIDGET_IP_RULE);
    if (!ipVerdict.allowed) {
      return json({ error: "rate_limited" }, 429, {
        "Retry-After": String(ipVerdict.retryAfterSeconds),
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = widgetTurnSchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: "invalid_message" }, 400);
    }

    const { message, sessionId } = parsed.data;
    const visitorLanguage = pickWidgetLanguage(parsed.data.lang);

    const sessionVerdict = checkRateLimit(
      `session:${widgetKey}:${sessionId}`,
      WIDGET_SESSION_RULE
    );
    if (!sessionVerdict.allowed) {
      return json({ error: "rate_limited" }, 429, {
        "Retry-After": String(sessionVerdict.retryAfterSeconds),
      });
    }

    // ── 2. The key is the whole authentication ─────────────────────────────
    // One index probe on a unique column. The agent's owner travels with it, so
    // there is no second lookup to derive whose credits are about to be spent.
    const integration = await db.integration.findUnique({
      where: { integrationId: widgetKey },
      select: {
        platform: true,
        connected: true,
        chatbot: {
          select: {
            chatbotId: true,
            userId: true,
            workspaceId: true,
            model: true,
            promptMode: true,
            systemPrompt: true,
            compiledPrompt: true,
            rawPrompt: true,
            chatbotMode: true,
            temperature: true,
            topP: true,
            maxTokens: true,
            status: true,
            user: { select: { plan: true, region: true } },
          },
        },
      },
    });

    const bot = integration?.chatbot;

    // Every one of these is the same answer to the visitor — a 404. What
    // differs is only whether the merchant can act on it, which is why the
    // reason is logged and not returned.
    if (!integration || integration.platform !== "website" || !integration.connected) {
      console.warn("[WIDGET_CHAT] refusing unreachable widget", {
        widgetKey,
        platform: integration?.platform ?? null,
        connected: integration?.connected ?? null,
      });
      return json({ error: "not_found" }, 404);
    }

    if (!bot || bot.status !== "active" || !bot.user) {
      console.warn("[WIDGET_CHAT] agent unavailable", {
        widgetKey,
        status: bot?.status ?? null,
      });
      return json({ error: "not_found" }, 404);
    }

    // ── 3. The model this plan may actually run ────────────────────────────
    //
    // ⚠️ A merchant whose plan no longer covers Pro must NOT be told to upgrade
    //    here — the reader would be their customer, who cannot. So where the
    //    Playground returns 403, this falls back to the cheapest tier.
    //
    // ⚠️ The fallback is the literal `"fast"`, not `bot.model`. A Pro bot
    //    stores a *model id*, and `resolveModelConfig("simple", "<pro-model>")`
    //    would happily validate and run it — the silent overspend
    //    `lib/ai/plan-model-access.ts` was written to stop. Asking for the
    //    `fast` tier is what guarantees a Starter-appropriate model.
    const plan = bot.user.plan;
    const region = (bot.user.region || "bd") as Region;

    const planResolution = await resolveModelForPlan(
      bot.promptMode,
      bot.model,
      plan,
      region
    );

    const modelConfig =
      planResolution.status === "allowed"
        ? planResolution.config
        : await resolveModelConfig("simple", "fast");

    const model = modelConfig.modelId;

    // ── 4. May this merchant spend at all? ─────────────────────────────────
    //
    // Sending both the user and the chatbot id, and neither `userId` nor
    // `workspaceId` from the request: they come from the row the key resolved
    // to, so a caller cannot name someone else's balance.
    const quota = await resolveQuotaAnswer({
      task: "chat",
      userId: bot.userId,
      workspaceId: bot.workspaceId,
      chatbotId: bot.chatbotId,
      modelId: model,
      isTestChat: false,
      isFreeMessage: false,
    });

    if (!quota.allowed) {
      // 200, not 402. The refusal is written for the visitor — it names no
      // balance, no plan and no billing (`public/locales/*/ai-errors.json`
      // `reply_unavailable`) — so it belongs in the conversation as an ordinary
      // reply. Returning an error status would surface a failure in the
      // merchant's chat window for what is, to the person reading it, an
      // ordinary answer.
      return json({ reply: quota.replyText[visitorLanguage] }, 200);
    }

    // ── 5. The agent's own prompt ──────────────────────────────────────────
    let systemPrompt = bot.compiledPrompt;
    if (!systemPrompt && bot.rawPrompt) {
      try {
        systemPrompt = await compilePrompt(bot.rawPrompt, bot.chatbotMode);
      } catch (error) {
        console.error("[WIDGET_CHAT_COMPILE_PROMPT]", error);
      }
    }
    systemPrompt = systemPrompt || bot.systemPrompt || "You are a helpful assistant.";

    // ── 6. Forward to n8n, exactly as the Playground does ──────────────────
    const n8nWebhookUrl = process.env.N8N_WEB_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error("[WIDGET_CHAT] N8N_WEB_WEBHOOK_URL is not set");
      return json({ error: "unavailable" }, 503);
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbotId: bot.chatbotId,
        sessionId,
        userMessage: message,
        systemPrompt,
        model,
        creditCost: modelConfig.credits,
        temperature: bot.temperature,
        topP: bot.topP,
        maxTokens: bot.maxTokens,
        chatInput: message,
        userId: bot.userId,
        // `playground` means "a Driplare user is testing". A widget visitor is a
        // real customer, so the platform is `web` — the same channel the billing
        // reports already group the website widget under.
        platform: "web",
        channel: "web",
        secret: process.env.N8N_CALLBACK_SECRET,
      }),
    });

    if (!response.ok) {
      console.error("[WIDGET_CHAT_N8N]", await response.text());
      return json({ error: "unavailable" }, 502);
    }

    const rawText = await response.text();
    let data: Record<string, unknown> | unknown[] | null = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("[WIDGET_CHAT_PARSE] non-JSON from n8n:", rawText.slice(0, 200));
        return json({ error: "unavailable" }, 502);
      }
    }

    if (!data) {
      console.error("[WIDGET_CHAT_EMPTY] n8n returned an empty body");
      return json({ error: "unavailable" }, 502);
    }

    // n8n answers with either an array or an object depending on the workflow.
    const payload: Record<string, unknown> =
      Array.isArray(data) && data.length > 0
        ? ((data[0] as Record<string, unknown>) ?? {})
        : typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};

    const reply = String(
      payload.replyText || payload.output || payload.reply || payload.text || ""
    );

    // ── 7. Bill the merchant ───────────────────────────────────────────────
    //
    // Only when n8n did not already report that it billed — `billingOk` is the
    // single guard against charging twice for one reply, and it has to be read
    // here rather than assumed.
    if (payload.billingOk !== true) {
      try {
        const charge = await chargeUsage({
          userId: bot.userId,
          chatbotId: bot.chatbotId,
          sessionId,
          channel: "web",
          modelId: model,
          promptTokens: Number(payload.promptTokens) || 0,
          completionTokens: Number(payload.completionTokens) || 0,
          llmCallCount: 1,
          // A real customer, not the merchant testing: no test-chat discount.
          isTestChat: false,
          isFreeMessage: false,
          tokensAreExact: payload.tokensAreExact === true,
        });

        if (charge.kind === "insufficient") {
          console.warn("[WIDGET_CHAT_BILLING] balance too low, nothing charged", {
            chatbotId: bot.chatbotId,
            creditsRequired: charge.creditsRequired,
          });
        }
      } catch (error) {
        // The visitor still gets their answer. Billing failures are reconciled
        // separately; a customer staring at a spinner is not a recovery path.
        console.error("[WIDGET_CHAT_BILLING_ERROR]", error);
      }
    }

    return json({ reply }, 200);
  } catch (error) {
    console.error("[WIDGET_CHAT]", error);
    return json({ error: "unavailable" }, 500);
  }
}
