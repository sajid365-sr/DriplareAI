import { NextResponse } from "next/server";

import { getOpenRouterModelPayload } from "@/lib/ai/openrouter-service";

export const revalidate = 43200;

export async function GET() {
  try {
    const payload = await getOpenRouterModelPayload();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[OPENROUTER_MODELS_ROUTE]", error);
    return NextResponse.json({ error: "Failed to load OpenRouter models" }, { status: 500 });
  }
}
