import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import {
  generateRawPromptFromWizard,
  getWizardCategory,
  type WizardData,
} from "@/lib/ai/wizard-schema";
import { compilePrompt, type CustomSchemaSummary } from "@/lib/ai/prompt-assembler";
import { db } from "@/lib/core/db";
import { listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";

/**
 * POST /api/chatbots/wizard-compile
 *
 * Accepts `{ category, wizardData, chatbotId? }` and returns `{ rawPrompt, compiledPrompt }`.
 *
 * Pipeline:
 *   1. `generateRawPromptFromWizard(category, wizardData)` — converts the
 *      structured wizard answers into a human-readable Bengali raw prompt.
 *   2. Looks up any existing `CustomTableSchema` if `chatbotId` is provided.
 *   3. `compilePrompt(rawPrompt, category, meta, customSchemas)` — assembles
 *      the dynamic category-aware production system prompt.
 */
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category, wizardData, chatbotId } = body;

    if (!category || typeof category !== "string") {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    if (!getWizardCategory(category)) {
      return NextResponse.json(
        { error: `Unknown category "${category}"` },
        { status: 400 }
      );
    }

    if (!wizardData || typeof wizardData !== "object" || Array.isArray(wizardData)) {
      return NextResponse.json(
        { error: "wizardData must be an object" },
        { status: 400 }
      );
    }

    let customSchemas: CustomSchemaSummary[] | undefined;
    if (chatbotId) {
      const bot = await db.chatbot.findFirst({
        where: { chatbotId, userId: user.userId },
        select: { chatbotId: true, workspaceId: true },
      });
      const workspaceBots = bot?.workspaceId
        ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
        : bot ? [{ chatbotId: bot.chatbotId }] : [];
      const schemas = await listWorkspaceBusinessForms(bot?.workspaceId ?? null, workspaceBots.map((workspaceBot) => workspaceBot.chatbotId));
      if (schemas.length > 0) {
        customSchemas = schemas.map((s) => ({
          name: s.name,
          slug: s.slug,
          description: s.description,
          fields: Array.isArray(s.fields)
            ? (s.fields as unknown as CustomSchemaSummary["fields"])
            : [],
        }));
      }
    }

    // Build the human-readable Bengali raw prompt from the structured answers.
    const rawPrompt = generateRawPromptFromWizard(category, wizardData as WizardData);

    // Assemble the full production system prompt (Header + Translated + Footer).
    const compiledPrompt = await compilePrompt(
      rawPrompt,
      category,
      { userId: user.userId },
      customSchemas
    );

    return NextResponse.json({ rawPrompt, compiledPrompt });
  } catch (error) {
    console.error("[WIZARD_COMPILE_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
