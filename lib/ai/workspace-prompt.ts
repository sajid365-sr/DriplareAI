import { db } from "@/lib/core/db";
import { formatAgentInstructions } from "@/lib/domain/agent-instructions";
import { formatWorkspaceAIRules, parseWorkspaceAIRules } from "@/lib/domain/workspace-ai-settings";
import { formatWorkspaceDeliveryPolicy } from "@/lib/domain/workspace-business-profile";

type WorkspacePromptSource = {
  workspaceId: string | null;
};

type AgentPromptSource = {
  agentRole?: string | null;
  agentInstructions?: unknown;
};

/** Appends the role and capabilities saved for one Agent. */
export async function withAgentInstructions(agent: AgentPromptSource, agentPrompt: string): Promise<string> {
  if (!agent.agentRole && !agent.agentInstructions) return agentPrompt;
  const instructions = formatAgentInstructions(agent.agentRole ?? null, agent.agentInstructions);
  if (!instructions) return agentPrompt;
  return [
    agentPrompt,
    "[AGENT ROLE AND AUTHORIZED CAPABILITIES]",
    "These instructions define this Agent's assigned job and permitted business forms. Use shared business facts where relevant. Do not exceed the listed responsibilities, permissions, or actions.",
    instructions,
    "[/AGENT ROLE AND AUTHORIZED CAPABILITIES]",
  ].filter(Boolean).join("\n\n");
}

/** Adds live workspace rules to an agent prompt without copying them into the agent record. */
export async function withWorkspaceAIRules(
  workspace: WorkspacePromptSource,
  agentPrompt: string
): Promise<string> {
  if (!workspace.workspaceId) return agentPrompt;

  const [business, settings] = await Promise.all([
    db.workspace.findUnique({
      where: { workspaceId: workspace.workspaceId },
      select: { name: true, businessProfile: true },
    }),
    db.workspaceAISettings.findUnique({
      where: { workspaceId: workspace.workspaceId },
      select: { corePrompt: true, rulesJson: true },
    }),
  ]);

  const profile = business?.businessProfile && typeof business.businessProfile === "object" && !Array.isArray(business.businessProfile)
    ? business.businessProfile as Record<string, unknown>
    : {};
  const profileLines = [
    business?.name ? `Business name: ${business.name}` : "",
    typeof profile.description === "string" ? `Business description: ${profile.description}` : "",
    typeof profile.phone === "string" ? `Business phone: ${profile.phone}` : "",
    typeof profile.email === "string" ? `Business email: ${profile.email}` : "",
    typeof profile.website === "string" ? `Business website: ${profile.website}` : "",
    typeof profile.address === "string" ? `Business address: ${profile.address}` : "",
    typeof profile.openingHours === "string" ? `Opening hours: ${profile.openingHours}` : "",
    typeof profile.paymentMethods === "string" ? `Accepted payment methods: ${profile.paymentMethods}` : "",
    typeof profile.deliveryDetails === "string" ? `Delivery details: ${profile.deliveryDetails}` : "",
  ].filter((line) => {
    const separator = line.indexOf(":");
    return separator >= 0 && line.slice(separator + 1).trim().length > 0;
  });
  const deliveryPolicy = formatWorkspaceDeliveryPolicy(profile.deliveryPolicy);
  if (deliveryPolicy) profileLines.push("Structured delivery policy:\n" + deliveryPolicy);
  const profileSection = profileLines.length
    ? [
        "[BUSINESS PROFILE — SHARED FACTS]",
        "Use these merchant-saved details as business facts. Do not infer missing details.",
        profileLines.join("\n"),
        "[/BUSINESS PROFILE]",
      ].join("\n\n")
    : "";

  if (!settings) return [agentPrompt, profileSection].filter(Boolean).join("\n\n");

  const rules = parseWorkspaceAIRules(settings.rulesJson);
  const renderedRules = formatWorkspaceAIRules(settings.corePrompt, rules);
  if (!renderedRules) return [agentPrompt, profileSection].filter(Boolean).join("\n\n");

  return [
    agentPrompt,
    profileSection,
    "[WORKSPACE AI RULES — APPLY TO EVERY AGENT IN THIS WORKSPACE]",
    "Follow these workspace-wide business instructions in every customer conversation. They take precedence over agent-specific style or task preferences. They do not override platform safety requirements or the tools and actions actually available to you.",
    renderedRules,
    "[/WORKSPACE AI RULES]",
  ].filter(Boolean).join("\n\n");
}
