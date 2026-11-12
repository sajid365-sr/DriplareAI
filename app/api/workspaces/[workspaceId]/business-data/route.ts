import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import { parseWorkspaceAIRules } from "@/lib/domain/workspace-ai-settings";
import { getWorkspaceBusinessBotIds, listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";
import {
  getWorkspaceBusinessProfileFields,
  WorkspaceBusinessProfileCategoryFieldsSchema,
  WorkspaceBusinessProfileCustomFieldsSchema,
  WorkspaceDeliveryPolicySchema,
} from "@/lib/domain/workspace-business-profile";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!access.canRead) return NextResponse.json({ error: "Business access denied" }, { status: 403 });

  try {
    const workspace = await db.workspace.findUnique({
      where: { workspaceId },
      select: { workspaceId: true, name: true, category: true, logoUrl: true, businessProfile: true },
    });
    if (!workspace) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const botIds = await getWorkspaceBusinessBotIds(workspaceId, "");
    const fallbackScope = botIds.length ? [{ workspaceId: null, chatbotId: { in: botIds } }] : [];
    const [products, activeOffers, totalOffers, orders, records, sources, knowledgeItems, settings, courier, agents, channels, forms] = await Promise.all([
      db.product.count({ where: { OR: [{ workspaceId }, ...fallbackScope], isActive: true } }),
      db.merchantCoupon.count({ where: { workspaceId, active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }] } }),
      db.merchantCoupon.count({ where: { workspaceId } }),
      db.order.count({ where: { OR: [{ workspaceId }, ...fallbackScope] } }),
      db.customRecord.count({ where: { OR: [{ workspaceId }, ...(botIds.length ? [{ workspaceId: null, chatbotId: { in: botIds } }] : [])] } }),
      db.source.count({ where: { workspaceId, isGlobal: true } }),
      db.workspaceKnowledgeItem.count({ where: { workspaceId, archived: false } }),
      db.workspaceAISettings.findUnique({ where: { workspaceId }, select: { corePrompt: true, rulesJson: true } }),
      db.courierConfig.findUnique({ where: { workspaceId }, select: { steadfastEnabled: true, pathaoEnabled: true, redxEnabled: true } }),
      db.chatbot.count({ where: { workspaceId } }),
      botIds.length ? db.integration.count({ where: { chatbotId: { in: botIds }, connected: true, status: "active" } }) : Promise.resolve(0),
      listWorkspaceBusinessForms(workspaceId, botIds),
    ]);
    const rules = parseWorkspaceAIRules(settings?.rulesJson ?? null);
    const ruleCount = [settings?.corePrompt, rules.brandVoice, rules.languagePolicy, rules.customerAddress, ...rules.universalPolicies, ...rules.boundaries, ...rules.customRules.map((rule) => rule.instruction)]
      .filter((value) => typeof value === "string" && value.trim()).length;

    return NextResponse.json({
      workspace,
      profile: workspace.businessProfile ?? {},
      counts: {
        products,
        activeOffers,
        totalOffers,
        orders,
        records,
        forms: forms.length,
        sharedKnowledge: sources + knowledgeItems,
        businessRules: ruleCount,
        agents,
        connectedChannels: channels,
      },
      courier: {
        configured: Boolean(courier?.steadfastEnabled || courier?.pathaoEnabled || courier?.redxEnabled),
        providers: [
          ...(courier?.steadfastEnabled ? ["Steadfast"] : []),
          ...(courier?.pathaoEnabled ? ["Pathao"] : []),
          ...(courier?.redxEnabled ? ["RedX"] : []),
        ],
      },
      canEdit: access.canWrite,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_BUSINESS_DATA_GET]", error);
    return NextResponse.json({ error: "Could not load business data" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Business profile edit access required" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid business profile" }, { status: 400 });

  const fields = ["description", "phone", "email", "website", "address", "openingHours", "paymentMethods", "deliveryDetails"] as const;
  const currentWorkspace = await db.workspace.findUnique({
    where: { workspaceId },
    select: { businessProfile: true, category: true },
  });
  if (!currentWorkspace) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  const storedProfile = currentWorkspace.businessProfile && typeof currentWorkspace.businessProfile === "object" && !Array.isArray(currentWorkspace.businessProfile)
    ? currentWorkspace.businessProfile as Record<string, unknown>
    : {};
  const profile: Record<string, unknown> = { ...storedProfile };
  for (const field of fields) {
    const value = (body as Record<string, unknown>)[field];
    if (value !== undefined && typeof value !== "string") return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    if (typeof value === "string") {
      profile[field] = value.trim().slice(0, field === "description" ? 2000 : field === "deliveryDetails" ? 1500 : 500);
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "categoryFields")) {
    const categoryFields = WorkspaceBusinessProfileCategoryFieldsSchema.safeParse((body as Record<string, unknown>).categoryFields);
    if (!categoryFields.success) return NextResponse.json({ error: "Invalid category-specific business fields" }, { status: 400 });
    const allowedKeys = new Set(getWorkspaceBusinessProfileFields(currentWorkspace.category).map((field) => field.key));
    if (Object.keys(categoryFields.data).some((key) => !allowedKeys.has(key))) {
      return NextResponse.json({ error: "A category-specific field is not supported for this business type" }, { status: 400 });
    }
    const storedCategoryFields = storedProfile.categoryFields && typeof storedProfile.categoryFields === "object" && !Array.isArray(storedProfile.categoryFields)
      ? storedProfile.categoryFields as Record<string, unknown>
      : {};
    profile.categoryFields = { ...storedCategoryFields, ...categoryFields.data };
  }
  if (Object.prototype.hasOwnProperty.call(body, "customFields")) {
    const customFields = WorkspaceBusinessProfileCustomFieldsSchema.safeParse((body as Record<string, unknown>).customFields);
    if (!customFields.success) {
      return NextResponse.json({ error: "Invalid custom business fields", issues: customFields.error.issues }, { status: 400 });
    }
    profile.customFields = customFields.data;
  }
  if (Object.prototype.hasOwnProperty.call(body, "deliveryPolicy")) {
    const deliveryPolicy = WorkspaceDeliveryPolicySchema.safeParse((body as Record<string, unknown>).deliveryPolicy);
    if (!deliveryPolicy.success) {
      return NextResponse.json({ error: "Invalid delivery areas or charges", issues: deliveryPolicy.error.issues }, { status: 400 });
    }
    profile.deliveryPolicy = deliveryPolicy.data;
  } else if (storedProfile.deliveryPolicy === undefined) {
    profile.deliveryPolicy = WorkspaceDeliveryPolicySchema.parse({});
  }

  try {
    const workspace = await db.workspace.update({ where: { workspaceId }, data: { businessProfile: profile as Prisma.InputJsonValue } });
    return NextResponse.json({ profile: workspace.businessProfile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_BUSINESS_PROFILE_PATCH]", error);
    return NextResponse.json({ error: "Could not save business profile" }, { status: 500 });
  }
}
