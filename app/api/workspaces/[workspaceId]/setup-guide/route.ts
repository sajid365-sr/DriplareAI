import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import { getWorkspaceBusinessBotIds, listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";
import { parseWorkspaceAIRules } from "@/lib/domain/workspace-ai-settings";

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
    const [products, rules, knowledge, courier, agents, channels, forms, playgroundTests] = await Promise.all([
      db.product.count({ where: { OR: [{ workspaceId }, ...fallbackScope], isActive: true } }),
      db.workspaceAISettings.findUnique({ where: { workspaceId }, select: { corePrompt: true, rulesJson: true } }),
      Promise.all([
        db.source.count({ where: { workspaceId, isGlobal: true } }),
        db.workspaceKnowledgeItem.count({ where: { workspaceId, archived: false } }),
      ]),
      db.courierConfig.findUnique({ where: { workspaceId }, select: { steadfastEnabled: true, pathaoEnabled: true, redxEnabled: true } }),
      db.chatbot.findMany({ where: { workspaceId }, select: { chatbotId: true, agentMode: true } }),
      botIds.length ? db.integration.count({ where: { chatbotId: { in: botIds }, connected: true, status: "active" } }) : Promise.resolve(0),
      listWorkspaceBusinessForms(workspaceId, botIds),
      botIds.length ? db.chatSession.count({ where: { chatbotId: { in: botIds }, platform: "playground" } }) : Promise.resolve(0),
    ]);
    const parsedRules = parseWorkspaceAIRules(rules?.rulesJson ?? null);
    const hasRules = Boolean(rules?.corePrompt?.trim() || parsedRules.brandVoice?.trim() || parsedRules.languagePolicy?.trim() || parsedRules.customerAddress?.trim() || parsedRules.universalPolicies.length || parsedRules.boundaries.length || parsedRules.customRules.some((rule) => rule.instruction.trim()));
    const isEcommerce = workspace.category.toLowerCase().includes("ecommerce") || workspace.category.toLowerCase().includes("e-commerce");
    const productReady = isEcommerce ? products > 0 : forms.length > 0;
    const courierReady = Boolean(courier?.steadfastEnabled || courier?.pathaoEnabled || courier?.redxEnabled);
    const hasConnectedChannels = channels > 0;
    const hasLiveAgent = agents.some((agent) => agent.agentMode === "live");
    const profile = workspace.businessProfile && typeof workspace.businessProfile === "object" && !Array.isArray(workspace.businessProfile)
      ? workspace.businessProfile as Record<string, unknown>
      : {};
    const hasBusinessProfile = Object.values(profile).some((value) => typeof value === "string" && value.trim().length > 0);
    const hasDeliveryDetails = typeof profile.deliveryDetails === "string" && profile.deliveryDetails.trim().length > 0;
    const deliveryPolicy = profile.deliveryPolicy && typeof profile.deliveryPolicy === "object" && !Array.isArray(profile.deliveryPolicy)
      ? profile.deliveryPolicy as { zones?: unknown }
      : {};
    const hasDeliveryZones = Array.isArray(deliveryPolicy.zones) && deliveryPolicy.zones.length > 0;
    const steps = [
      { key: "profile", complete: hasBusinessProfile },
      { key: "catalog", complete: productReady },
      { key: "operations", complete: hasRules || courierReady || hasDeliveryDetails || hasDeliveryZones },
      { key: "knowledge", complete: knowledge[0] + knowledge[1] > 0 },
      { key: "agent", complete: agents.length > 0 },
      { key: "channel", complete: hasConnectedChannels },
      { key: "test", complete: playgroundTests > 0 },
      { key: "live", complete: hasConnectedChannels && hasLiveAgent },
    ];

    return NextResponse.json({
      steps,
      completed: steps.filter((step) => step.complete).length,
      total: steps.length,
      canEdit: access.canWrite,
      firstAgentId: agents[0]?.chatbotId ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_SETUP_GUIDE_GET]", error);
    return NextResponse.json({ error: "Could not load setup progress" }, { status: 500 });
  }
}
