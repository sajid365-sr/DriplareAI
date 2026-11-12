import { NextResponse } from "next/server";
import { z } from "zod";

import { callModel } from "@/lib/ai/gateway";
import { aiErrorResponse } from "@/lib/ai/gateway-http";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

const requestSchema = z.object({ description: z.string().trim().min(20).max(6000) });
const suggestionSchema = z.object({
  description: z.string().max(2000),
  phone: z.string().max(500),
  email: z.string().max(500),
  website: z.string().max(500),
  address: z.string().max(500),
  openingHours: z.string().max(500),
  paymentMethods: z.string().max(500),
  deliveryDetails: z.string().max(1500),
});

type RouteContext = { params: Promise<{ workspaceId: string }> };

/** Suggests business-profile fields from merchant text or speech transcription; it never saves them. */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Business profile edit access required" }, { status: 403 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "Add a longer business description first" }, { status: 400 });

  try {
    const workspace = await db.workspace.findUnique({
      where: { workspaceId },
      select: { name: true, category: true },
    });
    if (!workspace) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const result = await callModel({
      task: "enhance_prompt",
      model: "google/gemini-2.5-flash",
      userId: user.userId,
      workspaceId,
      channel: "business_profile_suggestions",
      temperature: 0.1,
      maxTokens: 1000,
      messages: [{
        role: "user",
        content: [
          "Extract only facts explicitly stated in the merchant's description into the requested business profile fields.",
          "Never guess, complete, or invent a phone, email, address, business hour, payment method, price, delivery charge, delivery area, delivery time, or policy.",
          "If a value is missing or uncertain, return an empty string for that field.",
          "Preserve the merchant's wording for deliveryDetails and paymentMethods. Return one valid JSON object only with string values for every key: description, phone, email, website, address, openingHours, paymentMethods, deliveryDetails.",
          `Business name: ${workspace.name}`,
          `Business category: ${workspace.category}`,
          `Merchant description:\n${parsed.data.description}`,
        ].join("\n\n"),
      }],
    });

    const text = result.text?.trim() ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("The model returned no structured profile");
    const suggestions = suggestionSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!suggestions.success) throw new Error("The model returned invalid profile fields");
    return NextResponse.json({ suggestions: suggestions.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const handled = aiErrorResponse(error);
    if (handled) return handled;
    console.error("[WORKSPACE_BUSINESS_PROFILE_SUGGEST]", error);
    return NextResponse.json({ error: "Could not prepare business profile suggestions" }, { status: 502 });
  }
}
