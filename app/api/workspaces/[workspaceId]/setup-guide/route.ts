import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import { getWorkspaceBusinessBotIds, listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";
import { parseWorkspaceAIRules } from "@/lib/domain/workspace-ai-settings";
import { getWorkspaceSetupSteps } from "@/lib/domain/workspace-setup-progress";

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
      select: { workspaceId: true, name: true, category: true, businessProfile: true },
    });
    if (!workspace) return NextResponse.json({ error: "Business not found" }, { status: 404 });
    const botIds = await getWorkspaceBusinessBotIds(workspaceId, "");
    const fallbackScope = botIds.length ? [{ workspaceId: null, chatbotId: { in: botIds } }] : [];
    const [products, rules, courier, forms, agents] = await Promise.all([
      db.product.count({ where: { OR: [{ workspaceId }, ...fallbackScope], isActive: true } }),
      db.workspaceAISettings.findUnique({ where: { workspaceId }, select: { corePrompt: true, rulesJson: true } }),
      db.courierConfig.findUnique({ where: { workspaceId }, select: { steadfastEnabled: true, pathaoEnabled: true, redxEnabled: true } }),
      listWorkspaceBusinessForms(workspaceId, botIds),
      db.chatbot.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
        select: { chatbotId: true, agentMode: true },
      }),
    ]);
    const agentIds = agents.map((agent) => agent.chatbotId);
    const liveAgentIds = agents.filter((agent) => agent.agentMode === "live").map((agent) => agent.chatbotId);
    const [channels, liveChannels, successfulPlaygroundTests] = await Promise.all([
      agentIds.length ? db.integration.count({ where: { chatbotId: { in: agentIds }, connected: true, status: "active" } }) : Promise.resolve(0),
      liveAgentIds.length ? db.integration.count({ where: { chatbotId: { in: liveAgentIds }, connected: true, status: "active" } }) : Promise.resolve(0),
      agentIds.length ? db.aIUsageLog.count({ where: { chatbotId: { in: agentIds }, channel: "playground", completionTokens: { gt: 0 } } }) : Promise.resolve(0),
    ]);
    const parsedRules = parseWorkspaceAIRules(rules?.rulesJson ?? null);
    const hasRules = Boolean(rules?.corePrompt?.trim() || parsedRules.brandVoice?.trim() || parsedRules.languagePolicy?.trim() || parsedRules.customerAddress?.trim() || parsedRules.universalPolicies.length || parsedRules.boundaries.length || parsedRules.customRules.some((rule) => rule.instruction.trim()));
    const isEcommerce = workspace.category.toLowerCase().includes("ecommerce") || workspace.category.toLowerCase().includes("e-commerce");
    const productReady = isEcommerce ? products > 0 : forms.length > 0;
    const courierReady = Boolean(courier?.steadfastEnabled || courier?.pathaoEnabled || courier?.redxEnabled);
    const profile = workspace.businessProfile && typeof workspace.businessProfile === "object" && !Array.isArray(workspace.businessProfile)
      ? workspace.businessProfile as Record<string, unknown>
      : {};
    const hasBusinessProfile = Object.values(profile).some((value) => typeof value === "string" && value.trim().length > 0);
    const hasDeliveryDetails = typeof profile.deliveryDetails === "string" && profile.deliveryDetails.trim().length > 0;
    const deliveryPolicy = profile.deliveryPolicy && typeof profile.deliveryPolicy === "object" && !Array.isArray(profile.deliveryPolicy)
      ? profile.deliveryPolicy as { zones?: unknown }
      : {};
    const hasDeliveryZones = Array.isArray(deliveryPolicy.zones) && deliveryPolicy.zones.length > 0;
    const hasOperationsSetup = hasRules || courierReady || hasDeliveryDetails || hasDeliveryZones;
    const steps = getWorkspaceSetupSteps({
      business: hasBusinessProfile && productReady && hasOperationsSetup,
      agent: agents.length > 0,
      channel: channels > 0,
      test: successfulPlaygroundTests > 0,
      live: liveChannels > 0,
    });

    return NextResponse.json({
      steps,
      completed: steps.filter((step) => step.complete).length,
      total: steps.length,
      canEdit: access.canWrite,
      firstAgentId: agents[0]?.chatbotId ?? null,
      nextStep: steps.find((step) => !step.complete)?.key ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_SETUP_GUIDE_GET]", error);
    return NextResponse.json({ error: "Could not load setup progress" }, { status: 500 });
  }
}
