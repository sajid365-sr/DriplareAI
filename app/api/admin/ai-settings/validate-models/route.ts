import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

export async function POST() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // Fetch live model catalog from OpenRouter
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "User-Agent": "DriplareAI-Admin/1.0" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawModels: any[] = data.data || [];
    const liveModelIds = new Set(rawModels.map((m) => m.id));

    // Fetch existing settings from DB
    let existingSetting: any = null;
    if ((db as any).platformSetting) {
      existingSetting = await (db as any).platformSetting.findUnique({
        where: { key: "ai_credit_rules" },
      });
    }

    if (!existingSetting || !existingSetting.value) {
      return NextResponse.json(
        { error: "No AI credit rules found in database to validate." },
        { status: 404 }
      );
    }

    const savedValue = existingSetting.value as Record<string, any>;
    const currentModels: any[] = Array.isArray(savedValue.models)
      ? savedValue.models
      : [];

    let deprecatedCount = 0;

    const validatedModels = currentModels.map((m) => {
      const isStillLive = liveModelIds.has(m.id);
      if (!isStillLive) {
        deprecatedCount++;
        return {
          ...m,
          isMerchantActive: false,
          isDeprecated: true,
        };
      }
      return {
        ...m,
        isDeprecated: false,
      };
    });

    const updatedValue = {
      ...savedValue,
      models: validatedModels,
      updatedAt: new Date().toISOString(),
    };

    // Save updated models back to Database
    if ((db as any).platformSetting) {
      await (db as any).platformSetting.upsert({
        where: { key: "ai_credit_rules" },
        update: { value: updatedValue },
        create: {
          key: "ai_credit_rules",
          value: updatedValue,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deprecatedCount,
      totalValidated: validatedModels.length,
      settings: updatedValue,
      models: validatedModels,
    });
  } catch (error) {
    console.error("[VALIDATE_MODELS_ERROR]", error);
    return NextResponse.json(
      { error: "Could not validate models against OpenRouter catalog." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
