import { NextResponse } from "next/server";
import { z } from "zod";

import { chargeUsage, isUniqueViolation, recoverDuplicateCharge } from "@/lib/ai/charge-usage";

/**
 * POST /api/internal/ai-usage
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * n8n → Next.js বিলিং-এর একমাত্র দ্বার
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Facebook / WhatsApp / Instagram-এর message সরাসরি n8n-এ যায় — প্ল্যাটফর্ম
 * সেই পথে থাকে না। তাই reply শেষে n8n নিজেই এখানে ফিরে এসে জানায়: কে, কোন
 * মডেল, কত token। আসল দাম ও আসল credit এখানেই হিসাব হয়।
 *
 * (Playground / ড্যাশবোর্ড টেস্টের ক্ষেত্রে প্ল্যাটফর্মই কলটা করেছিল, তাই
 *  সেখানে `lib/ai/charge-usage.ts` সরাসরি ডাকা হয় — এই route দিয়ে যায় না।)
 *
 * ⚠️ আসল হিসাব-নিকাশ `lib/ai/charge-usage.ts`-এ, একটাই জায়গায়। এই ফাইল শুধু
 *    auth, body যাচাই আর HTTP উত্তর — যাতে দুই পথে নিয়ম আলাদা হয়ে না যায়।
 *
 * ── Auth ──────────────────────────────────────────────────────────────────────
 * হেডার: `x-n8n-secret` = `N8N_CALLBACK_SECRET` (রেপোর বাকি n8n endpoint-গুলোর মতোই)।
 *
 * ── Request body ──────────────────────────────────────────────────────────────
 * {
 *   runId:            string?   — n8n execution id (idempotency-র চাবি)
 *   userId:           string?   — না দিলে chatbotId থেকে বের করা হবে
 *   chatbotId:        string?
 *   sessionId:        string?
 *   channel:          string    — "facebook" | "whatsapp" | "instagram" | "web"
 *   modelId:          string    — OpenRouter model id
 *   promptTokens:     number
 *   completionTokens: number
 *   llmCallCount:     number?
 *   isTestChat:       boolean?  — ড্যাশবোর্ড টেস্ট হলে ক্রেডিটে গুণক বসবে
 *   isFreeMessage:    boolean?  — true হলে ক্রেডিট কাটবে না, শুধু লগ হবে
 *   tokensAreExact:   boolean?  — tracing থেকে পাওয়া আসল টোকেন হলে true
 *   extra:            { image?: boolean, audioMinutes?: number }?
 * }
 *
 * ── Response ──────────────────────────────────────────────────────────────────
 *   200 — { success, creditsSpent, creditsRemaining, costUsd, costBdt, costSource, duplicate? }
 *   402 — { error: "insufficient_credits", creditsRequired, creditsBalance }
 *   401 — { error: "Unauthorized" }
 */

const bodySchema = z.object({
  runId: z.string().min(1).max(128).optional(),
  userId: z.string().min(1).optional(),
  chatbotId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  channel: z.string().min(1).max(32).default("web"),
  modelId: z.string().min(1).max(200),
  promptTokens: z.number().int().min(0).default(0),
  completionTokens: z.number().int().min(0).default(0),
  llmCallCount: z.number().int().min(0).default(0),
  isTestChat: z.boolean().default(false),
  isFreeMessage: z.boolean().default(false),
  tokensAreExact: z.boolean().default(false),
  extra: z
    .object({
      image: z.boolean().optional(),
      audioMinutes: z.number().min(0).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  // ১. Auth — রেপোর বাকি n8n endpoint-গুলোর মতোই shared secret
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTERNAL_AI_USAGE] N8N_CALLBACK_SECRET সেট করা নেই!");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (req.headers.get("x-n8n-secret") !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // body stream একবারই পড়া যায়, তাই একবার পড়ে ধরে রাখি — P2002 ধরা পড়লে
  // runId দিয়েই প্রথম request-টার ফলাফল ফিরিয়ে দিতে হবে।
  let runId: string | undefined;
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // ২. Body যাচাই
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;
    runId = body.runId;

    // ৩. আসল কাজ — খরচ হিসাব, credit কাটা, লগ লেখা (সব এক transaction-এ)
    const result = await chargeUsage(body);

    switch (result.kind) {
      case "unknown_user":
        return NextResponse.json(
          { error: "userId নির্ধারণ করা যায়নি (userId বা বৈধ chatbotId দিন)" },
          { status: 400 },
        );

      case "insufficient":
        return NextResponse.json(
          {
            error: "insufficient_credits",
            creditsRequired: result.creditsRequired,
            creditsBalance: result.creditsBalance,
          },
          { status: 402 },
        );

      case "duplicate":
        // আগেই প্রক্রিয়া হয়েছে — দ্বিতীয়বার কিছু কাটা হয়নি
        return NextResponse.json({
          success: true,
          duplicate: true,
          creditsSpent: result.creditsSpent,
          costUsd: result.costUsd,
          costSource: result.costSource,
        });

      case "created":
        return NextResponse.json({
          success: true,
          creditsSpent: result.creditsSpent,
          creditsRemaining: result.creditsRemaining,
          costUsd: result.costUsd,
          costBdt: result.costBdt,
          costSource: result.costSource,
        });
    }
  } catch (error) {
    // ডবল-submit race-এ unique constraint-এ আটকালে সেটাও সফল ধরে নেওয়া হয় —
    // কারণ তখন প্রথম request-টাই কাজ শেষ করেছে।
    if (isUniqueViolation(error)) {
      const recovered = await recoverDuplicateCharge(runId).catch(() => null);
      return NextResponse.json({ success: true, duplicate: true, ...recovered });
    }

    console.error("[INTERNAL_AI_USAGE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
