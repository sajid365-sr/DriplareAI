import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { normalizeChatModel, resolveModelForPlan } from "@/lib/ai/chat-models";
import { toDeniedResponse } from "@/lib/ai/plan-model-access";
import type { Region } from "@/lib/core/region";
import { translateToEnglish } from "@/lib/ai/translation";
import { compilePrompt } from "@/lib/ai/prompt-assembler";

const SIMPLE_TIER_KEYS = new Set(["fast", "smart", "genius"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbot = await db.chatbot.findUnique({
      where: { chatbotId, userId },
      include: {
        _count: {
          select: {
            sources: true,
            faqs: true,
            // Counted so the playground's setup checklist can tell whether the
            // agent has been trained at all — sample replies are knowledge too,
            // and a merchant can legitimately add only those.
            sampleReplies: true,
            products: true,
          },
        },
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const normalizedModel = SIMPLE_TIER_KEYS.has(chatbot.model)
      ? null
      : await normalizeChatModel(chatbot.provider, chatbot.model);
    return NextResponse.json({
      ...chatbot,
      chatbotMode: chatbot.chatbotMode,
      systemPrompt: chatbot.systemPromptRaw ?? chatbot.systemPrompt,
      provider: normalizedModel?.provider ?? chatbot.provider,
      model: normalizedModel?.model ?? chatbot.model,
    });
  } catch (error) {
    console.error("[CHATBOT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, model, provider, temperature, topP, maxTokens, systemPrompt, avatarBase64, status, chatbotMode, promptMode, wizardData, rawPrompt, compiledPrompt } = body;
    const shouldStoreSimpleTier = promptMode === "simple" && SIMPLE_TIER_KEYS.has(model);
    const normalizedModel =
      model || provider
        ? shouldStoreSimpleTier
          ? null
          : await normalizeChatModel(provider, model)
        : null;

    // ── Plan gate ────────────────────────────────────────────────────────────
    // ⚠️ কেবল মডেল **বদলালে** যাচাই — নাম বদলানো বা prompt সেভ করার সময় নয়।
    //    নাহলে plan downgrade-এর পর পুরনো করে রাখা একটা chatbot-এর নাম বদলাতে
    //    গেলেও ৪০৩ আসত, অথচ অনুরোধটার সঙ্গে মডেলের কোনো সম্পর্কই নেই।
    //    (ওই পুরনো মডেলটা নিয়ে যা করার, তা করে downgrade-এর reconciliation
    //    আর সর্বশেষে চ্যাট রুটের গার্ড — এখানে নয়।)
    //
    //    ⚠️ শর্তে `promptMode`-ও আছে, কেবল `model || provider` নয়। নাহলে
    //    `{ promptMode: "pro" }` একা পাঠিয়ে দিলেই গার্ডটা পুরো বাদ পড়ত —
    //    অর্থাৎ সেভ বাটনে চাপ না দিয়েও কেউ plan-এর বেড়া টপকাতে পারতেন।
    if (model || provider || promptMode) {
      const user = await db.user.findUnique({
        where: { userId },
        select: { plan: true, region: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const denied = toDeniedResponse(
        await resolveModelForPlan(
          promptMode || "",
          model,
          user.plan,
          (user.region || "bd") as Region
        )
      );
      if (denied) return denied;
    }

    // Status can be updated freely as paused chatbots are already counted towards the limit

    let updatedSystemPrompt = systemPrompt;
    let systemPromptRaw = undefined;
    let finalCompiledPrompt = undefined;

    if (rawPrompt !== undefined) {
      // New dual-prompt flow: the client sends the human-readable raw prompt
      // plus the pre-compiled production prompt. Recompile only when the
      // compiled prompt is missing (e.g. legacy clients).
      systemPromptRaw = rawPrompt;
      finalCompiledPrompt = compiledPrompt;
      if (!finalCompiledPrompt) {
        try {
          finalCompiledPrompt = await compilePrompt(rawPrompt);
        } catch (err) {
          console.error("Prompt compile error during update:", err);
        }
      }
      updatedSystemPrompt = finalCompiledPrompt;
    } else if (systemPrompt !== undefined) {
      // Legacy flow: raw prompt → translate + compile.
      systemPromptRaw = systemPrompt;
      try {
        updatedSystemPrompt = await translateToEnglish(systemPrompt);
        finalCompiledPrompt = await compilePrompt(systemPrompt);
      } catch (err) {
        console.error("Translation error during update:", err);
      }
    }

    const chatbot = await db.chatbot.update({
      where: { chatbotId, userId },
      data: {
        ...(name && { name }),
        ...(normalizedModel && {
          model: normalizedModel.openRouterModel,
          provider: normalizedModel.provider,
        }),
        ...(shouldStoreSimpleTier && {
          model,
          provider: provider || "openrouter",
        }),
        ...(temperature !== undefined && { temperature }),
        ...(topP !== undefined && { topP }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...((rawPrompt !== undefined || systemPrompt !== undefined) && {
          systemPrompt: updatedSystemPrompt,
          systemPromptRaw,
          rawPrompt: systemPromptRaw,
          compiledPrompt: finalCompiledPrompt,
        }),
        ...(chatbotMode !== undefined && { chatbotMode }),
        ...(promptMode !== undefined && { promptMode }),
        ...(wizardData !== undefined && { wizardData }),
        ...(avatarBase64 !== undefined && { avatarBase64 }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({
      ...chatbot,
      chatbotMode: chatbot.chatbotMode,
      systemPrompt: chatbot.systemPromptRaw ?? chatbot.systemPrompt,
    });
  } catch (error) {
    console.error("[CHATBOT_PUT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.chatbot.delete({
      where: { chatbotId, userId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[CHATBOT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
