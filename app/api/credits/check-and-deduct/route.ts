import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import {
  getModelTier,
  getCreditCostByTier,
  CREDIT_COSTS,
  type ModelTier,
} from "@/lib/domain/credit-config";
import { logAiUsage } from "@/lib/ai/usage-logger";

/**
 * POST /api/credits/check-and-deduct
 * 
 * Credit check করে deduct করার central endpoint।
 * n8n এবং Next.js API routes উভয়ই এটি call করতে পারে।
 * 
 * Request Body:
 *   userId           — Clerk user ID
 *   action_type      — e.g. "test_chat", "compare", "enhance_prompt", "facebook_reply", "whatsapp_reply", "instagram_reply", "web_reply"
 *   model            — OpenRouter model string (optional, reply-type actions-এ প্রয়োজন)
 *   chatbotId        — chatbot ID (optional, logging-এর জন্য)
 *   sessionId        — session ID (optional)
 *   promptTokens     — prompt token count (optional, default 0)
 *   completionTokens — completion token count (optional, default 0)
 *   channel          — custom channel identifier (optional)
 *   extra            — { image?: boolean, audio_minutes?: number } (optional)
 *   is_test_chat     — boolean, dashboard test chat হলে ×2 multiplier apply হবে
 * 
 * Response:
 *   200 — { success: true, credits_spent, credits_remaining }
 *   402 — { error: "insufficient_credits", credits_required, credits_balance }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId,
      action_type,
      model,
      chatbotId,
      sessionId,
      promptTokens,
      completionTokens,
      channel: bodyChannel,
      extra,
      is_test_chat,
    } = body;

    if (!userId || !action_type) {
      return NextResponse.json(
        { error: "userId and action_type are required" },
        { status: 400 }
      );
    }

    // User এবং তার credit balance fetch করা
    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Credit cost calculate করা
    let creditsRequired = 0;
    let model_tier: ModelTier | null = null;

    const openRouterModel = model || "google/gemini-2.5-flash-lite";

    if (action_type === "enhance_prompt") {
      creditsRequired = CREDIT_COSTS.enhance_prompt;
    } else if (
      action_type === "test_chat" ||
      action_type === "compare" ||
      action_type === "facebook_reply" ||
      action_type === "whatsapp_reply" ||
      action_type === "instagram_reply" ||
      action_type === "web_reply"
    ) {
      // Model-based reply cost
      model_tier = getModelTier(openRouterModel);
      creditsRequired = getCreditCostByTier(model_tier);

      // Test chat (dashboard playground) — ×2 multiplier
      if (is_test_chat) {
        creditsRequired *= CREDIT_COSTS.test_chat_multiplier;
      }
    }

    // Extra costs যোগ করা (image, audio)
    if (extra?.image) {
      creditsRequired += CREDIT_COSTS.image_message;
    }
    if (extra?.audio_minutes && extra.audio_minutes > 0) {
      creditsRequired += Math.ceil(extra.audio_minutes) * CREDIT_COSTS.audio_per_minute;
    }

    // File embedding cost (per 100kb)
    if (action_type === "file_embedding" && extra?.size_kb) {
      creditsRequired = Math.ceil(extra.size_kb / 100) * CREDIT_COSTS.file_embedding_per_100kb;
    }

    // Credit balance check
    if (user.creditsBalance < creditsRequired) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          credits_required: creditsRequired,
          credits_balance: user.creditsBalance,
        },
        { status: 402 }
      );
    }

    // Credits deduct করা এবং transaction log করা
    const [updatedUser] = await db.$transaction([
      db.user.update({
        where: { userId },
        data: {
          creditsBalance:      { decrement: creditsRequired },
          creditsUsedThisCycle: { increment: creditsRequired },
        },
        select: { creditsBalance: true },
      }),
      db.creditTransaction.create({
        data: {
          userId,
          chatbotId: chatbotId ?? null,
          action_type,
          model_tier:   model_tier ?? null,
          credits_spent: creditsRequired,
          metadata: {
            model:        openRouterModel,
            is_test_chat: is_test_chat ?? false,
            extra:        extra ?? null,
          },
        },
      }),
    ]);

    // Determine channel string
    let channelName = bodyChannel || action_type;
    if (action_type === "facebook_reply") channelName = "facebook";
    if (action_type === "whatsapp_reply") channelName = "whatsapp";
    if (action_type === "instagram_reply") channelName = "instagram";
    if (action_type === "web_reply") channelName = "web";
    if (action_type === "test_chat") channelName = "playground";

    // Asynchronously log AI token usage & cost (fire-and-forget)
    logAiUsage({
      chatbotId: chatbotId ?? undefined,
      sessionId: sessionId ?? undefined,
      channel: channelName,
      modelId: openRouterModel,
      promptTokens: Number(promptTokens) || 0,
      completionTokens: Number(completionTokens) || 0,
      userId,
      creditsDeducted: creditsRequired,
    }).catch((err) => console.error("[CREDITS_CHECK_DEDUCT_LOG_USAGE_ERROR]", err));

    return NextResponse.json({
      success:          true,
      credits_spent:    creditsRequired,
      credits_remaining: updatedUser.creditsBalance,
    });
  } catch (error) {
    console.error("[CREDITS_CHECK_DEDUCT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
