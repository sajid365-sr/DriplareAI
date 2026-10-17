import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/core/admin-auth";
import { applyDerivation, buildDerivationPreview } from "@/lib/ai/credit-plan";

/**
 * Credit derivation — the diff behind `/admin/ai-settings`' "Derive from price".
 *
 *   GET  ?targetBdtPerCredit=&promptTokens=&completionTokens=   → the diff, read-only
 *   POST { targetBdtPerCredit?, expectedTokens?, confirm[] }    → writes the diff
 *
 * Every proposed credit figure is recomputed here from the stored catalogue and
 * the live OpenRouter snapshot. The client sends policy — a target, a token
 * estimate, which rows it accepts — and never a number to write.
 */

/** `null` for an absent or unparseable query value, so the stored setting wins. */
function numberParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const params = new URL(req.url).searchParams;
    const promptTokens = numberParam(params.get("promptTokens"));
    const completionTokens = numberParam(params.get("completionTokens"));

    // Both halves or neither: a prompt-only override would silently pair a new
    // prompt count with the stored completion count, which reads as a deliberate
    // choice and is not one.
    const expectedTokens =
      promptTokens === undefined && completionTokens === undefined
        ? undefined
        : {
            prompt: promptTokens ?? 0,
            completion: completionTokens ?? 0,
          };

    const preview = await buildDerivationPreview({
      targetBdtPerCredit: numberParam(params.get("targetBdtPerCredit")),
      expectedTokens,
    });

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("[ADMIN_CREDIT_DERIVATION_GET]", error);
    return NextResponse.json(
      { error: "Could not build the credit derivation preview." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = (await req.json()) as Record<string, unknown>;

    const confirm = Array.isArray(body.confirm)
      ? body.confirm.filter((id): id is string => typeof id === "string")
      : [];

    const result = await applyDerivation({
      targetBdtPerCredit: body.targetBdtPerCredit,
      expectedTokens: body.expectedTokens,
      confirm,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN_CREDIT_DERIVATION_POST]", error);

    // "No row yet" is the admin's next step, not a server fault — say so plainly
    // instead of a generic 500 they cannot act on.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("No ai_credit_rules row exists")) {
      return NextResponse.json({ error: message, code: "no_settings_row" }, { status: 409 });
    }

    return NextResponse.json({ error: "Could not apply derived credits." }, { status: 500 });
  }
}
