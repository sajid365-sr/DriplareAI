import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getWorkspaceBusinessBotIds, listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";
import { AgentInstructionsSchema, EMPTY_AGENT_INSTRUCTIONS, parseAgentInstructions } from "@/lib/domain/agent-instructions";

type RouteContext = { params: Promise<{ chatbotId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { chatbotId } = await params;
  const bot = await getOwnedChatbot(userId, chatbotId);
  if (!bot) return NextResponse.json({ error: "AI Agent not found" }, { status: 404 });

  try {
    const [integrations, forms] = await Promise.all([
      db.integration.findMany({ where: { chatbotId: bot.chatbotId, connected: true }, select: { platform: true } }),
      (async () => {
        const botIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);
        return listWorkspaceBusinessForms(bot.workspaceId, botIds);
      })(),
    ]);
    const instructions = parseAgentInstructions(bot.agentInstructions);
    const configured = Boolean(instructions.purpose.trim() || instructions.responsibilities.trim() || instructions.tone.trim());
    return NextResponse.json({
      role: bot.agentRole ?? EMPTY_AGENT_INSTRUCTIONS.role,
      instructions,
      configured,
      channels: integrations.map(({ platform }) => platform),
      forms: forms.map(({ slug, name, description }) => ({ slug, name, description })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[AGENT_INSTRUCTIONS_GET]", error);
    return NextResponse.json({ error: "Could not load Agent instructions" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { chatbotId } = await params;
  const bot = await getOwnedChatbot(userId, chatbotId);
  if (!bot) return NextResponse.json({ error: "AI Agent not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const parsed = AgentInstructionsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the Agent instructions", issues: parsed.error.issues }, { status: 400 });

  try {
    const botIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);
    const forms = await listWorkspaceBusinessForms(bot.workspaceId, botIds);
    const knownSlugs = new Set(forms.map((form) => form.slug));
    const invalidSlugs = parsed.data.allowedFormSlugs.filter((slug) => !knownSlugs.has(slug));
    if (invalidSlugs.length) return NextResponse.json({ error: "One or more selected forms are unavailable", invalidSlugs }, { status: 400 });

    const updated = await db.chatbot.update({
      where: { chatbotId: bot.chatbotId, userId },
      data: { agentRole: parsed.data.role, agentInstructions: parsed.data },
      select: { agentRole: true, agentInstructions: true, updatedAt: true },
    });
    return NextResponse.json({
      role: updated.agentRole,
      instructions: parseAgentInstructions(updated.agentInstructions),
      updatedAt: updated.updatedAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[AGENT_INSTRUCTIONS_PATCH]", error);
    return NextResponse.json({ error: "Could not save Agent instructions" }, { status: 500 });
  }
}
