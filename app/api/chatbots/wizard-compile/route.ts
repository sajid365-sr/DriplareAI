import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import {
  generateRawPromptFromWizard,
  getWizardCategory,
  type WizardData,
} from "@/lib/ai/wizard-schema";
import { compilePrompt } from "@/lib/ai/prompt-assembler";

/**
 * POST /api/chatbots/wizard-compile
 *
 * Accepts `{ category, wizardData }` and returns `{ rawPrompt, compiledPrompt }`.
 *
 * Pipeline:
 *   1. `generateRawPromptFromWizard(category, wizardData)` — converts the
 *      structured wizard answers into a human-readable Bengali raw prompt.
 *   2. `compilePrompt(rawPrompt, category)` — assembles the full production
 *      system prompt (SYSTEM_HEADER + translated prompt + SYSTEM_FOOTER).
 */
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category, wizardData } = body;

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

    // Build the human-readable Bengali raw prompt from the structured answers.
    const rawPrompt = generateRawPromptFromWizard(category, wizardData as WizardData);

    // Assemble the full production system prompt (Header + Translated + Footer).
    const compiledPrompt = await compilePrompt(rawPrompt, category, { userId: user.userId });

    return NextResponse.json({ rawPrompt, compiledPrompt });
  } catch (error) {
    console.error("[WIZARD_COMPILE_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}