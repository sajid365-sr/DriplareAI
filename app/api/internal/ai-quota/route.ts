import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { failOpenAnswer, resolveQuotaAnswer, QUOTA_REPLY_TEXT } from "@/lib/ai/quota-answer";
import { timingSafeEqualString } from "@/lib/core/timing-safe";

/**
 * POST /api/internal/ai-quota — TASK-10 Part B-এর "quota pre-flight"
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * কেন এই endpoint দরকার
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * গ্রাহকের সামনের reply-টা তৈরি হয় **n8n-এর নিজের OpenRouter credential** দিয়ে,
 * তাই সেটি `lib/ai/gateway.ts`-এর বাইরে। অর্থাৎ Part A-এর quota আটকানোটুকু এই
 * পথে পৌঁছায় না — merchant-এর credit শূন্য হলেও AI চলতেই থাকে, আর খরচটা গায়ে
 * পড়ে প্ল্যাটফর্মের key-র উপর।
 *
 * n8n reply পাঠানোর **পরে** `POST /api/internal/ai-usage`-এ জানায়, আর
 * `chargeUsage()` তখন 402 দেয় — কিন্তু ততক্ষণে টাকা খরচ হয়ে গেছে। তাই সিদ্ধান্তটা
 * খরচের **আগে** নিতে হয়, আর সেই সিদ্ধান্তের একমাত্র সূত্র `assertAIQuota()`।
 *
 * ── TASK-11: এখন এটি একমাত্র দরজা নয় ────────────────────────────────────────
 * `POST /api/automations/evaluate` (n8n-এর `Automation Gate`) এখন **একই প্রশ্নের
 * উত্তরও** দেয়, যাতে n8n-কে দুবার আন্তঃমহাদেশীয় হপ কাটতে না হয় — সে `Quota Check`
 * নোডটি বাদ দিয়েছে। উত্তর-দুটো যাতে কখনো একই merchant নিয়ে ভিন্ন কথা না বলে,
 * সেইজন্য "জিজ্ঞেস করো ও উত্তরের আকার দাও" অংশটা এখন
 * `lib/ai/quota-answer.ts`-এ, আর এই route সেটিই ব্যবহার করে।
 *
 * রুটটি **থাকছে** ইচ্ছে করেই: merged নোড কাজ না করলে এটি ফেরার পথ, আর
 * `reply_unavailable` লেখার একটাই সূত্র এখান দিয়েই বাঁধা।
 *
 * ── কেন `decideQuota()` n8n-এ নকল করা হয়নি ───────────────────────────────────
 * n8n-এর `Fetch Bot Config` আগেই `creditsBalance` এনে দেয়, তাই `balance > 0`
 * চেকটা ওখানেই বিনা খরচে করা যেত। কিন্তু তাহলে একই নীতি দুই জায়গায় থাকত —
 * আর credit-এর হিসাব এই কোডবেসে ইচ্ছে করেই **একটাই** সূত্রে রাখা হয়েছে
 * (`lib/ai/credit-resolver.ts`-এর হেডার দেখুন): admin panel থেকে credit বদলালে
 * n8n-এর কপিটা পুরনো মান নিয়ে বসে থাকত। এছাড়া suspension নিয়ম ও merchant-কে
 * পাঠানো "credit শেষ" alert — দুটোই কেবল app-side থেকে সম্ভব।
 *
 * ── Auth ──────────────────────────────────────────────────────────────────────
 * `x-n8n-secret` = `N8N_CALLBACK_SECRET` — `/api/internal/*`-এর বাকি route-গুলোর
 * মতোই, `timingSafeEqualString` দিয়ে যাচাই করা।
 *
 * ── সব উত্তর 200, এমনকি আটকালেও ───────────────────────────────────────────────
 * `/api/internal/orders`-এর মতোই একই কারণ: n8n একটি non-2xx উত্তরকে node failure
 * বানায়, আর তারপর `onError` কী করবে সেটাই নির্ধারক হয়ে যায়। "এই merchant-এর credit
 * নেই" কোনো সার্ভার ত্রুটি নয় — এটি একটি স্বাভাবিক ব্যবসায়িক উত্তর, আর n8n-এর
 * সেটি সাদামাটা JSON হিসেবে পড়া উচিত। 401/400/500 কেবল সেইসব ক্ষেত্রে যেগুলো
 * model বা workflow ঠিক করতে পারে না।
 *
 * ── fail-open ─────────────────────────────────────────────────────────────────
 * অবরোধ কেবল তখনই জানানো হয় যখন `assertAIQuota()` **স্পষ্টভাবে** আটকায় — এবং সেই
 * অনুবাদটা `resolveQuotaAnswer()` করে। অন্য যেকোনো পথ — অজানা ত্রুটি, DB সমস্যা —
 * `allowed: true` ফেরত দেয়। কারণ `assertAIQuota()` নিজেই ইচ্ছে করে fail-open, আর
 * একটি ক্ষণিকের DB ত্রুটি যেন চলতি গ্রাহক-কথোপকথন চুপ করিয়ে না দেয়। n8n-এর দিকেও
 * একই নিয়ম (`Quota Allowed?` কেবল `allowed === false` দেখে), তাই দুই পাশ একই কথা বলে।
 */

const bodySchema = z.object({
  chatbotId: z.string().max(200).optional(),
  userId: z.string().max(200).optional(),
  workspaceId: z.string().max(200).optional(),
  modelId: z.string().max(200).optional(),
  channel: z.string().max(32).optional(),
  sessionId: z.string().max(200).optional(),
  isTestChat: z.boolean().default(false),
});

/** n8n `''` পাঠায় যখন কোনো মান না থাকে — খালি মানে "দেওয়া হয়নি", "ভুল" নয়। */
const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() ? value : undefined;

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTERNAL_AI_QUOTA] N8N_CALLBACK_SECRET is not set — endpoint closed");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!timingSafeEqualString(req.headers.get("x-n8n-secret"), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const chatbotId = orUndefined(body.chatbotId);
  const userId = orUndefined(body.userId);

  // Without either there is nobody to look a balance up for. Allowing is the
  // same fail-open choice the rest of this route makes.
  const sessionId = orUndefined(body.sessionId);
  if (sessionId && chatbotId) {
    const blockedSession = await db.chatSession.findFirst({
      where: { sessionId, chatbotId },
      select: { isAiBlocked: true },
    });
    if (blockedSession?.isAiBlocked) {
      return NextResponse.json({
        allowed: false,
        reason: "ai_blocked",
        replyText: QUOTA_REPLY_TEXT,
      });
    }
  }

  if (!chatbotId && !userId) {
    return NextResponse.json(failOpenAnswer("no_target"));
  }

  const answer = await resolveQuotaAnswer({
    // `chat` on purpose: this endpoint answers one question — "may this
    // conversation reply?", and `chat` is the only task whose policy is
    // charged. See `lib/domain/ai-task.ts`.
    task: "chat",
    userId,
    chatbotId,
    workspaceId: orUndefined(body.workspaceId),
    modelId: orUndefined(body.modelId),
    isTestChat: body.isTestChat,
    isFreeMessage: false,
  });

  return NextResponse.json(answer);
}
