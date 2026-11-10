import type { WorkspaceSetupStepKey } from "./workspace-setup-progress";

export function getWorkspaceSetupStepHref(
  key: WorkspaceSetupStepKey,
  category: string,
  firstAgentId: string | null
): string {
  const isEcommerce = category.toLowerCase().includes("ecommerce") || category.toLowerCase().includes("e-commerce");
  const agentPath = firstAgentId ? `/dashboard/aiagents/${encodeURIComponent(firstAgentId)}` : "/dashboard/aiagents";

  if (key === "business") return "/dashboard/knowledge-base?tab=business-data#business-profile";
  if (key === "agent") return firstAgentId ? `${agentPath}/setup` : agentPath;
  if (key === "channel") return firstAgentId ? `/dashboard/platforms?botId=${encodeURIComponent(firstAgentId)}` : agentPath;
  if (key === "test") return firstAgentId ? `${agentPath}/playground` : agentPath;
  if (key === "live") return firstAgentId ? `${agentPath}/setup` : agentPath;
  return isEcommerce ? "/dashboard/products" : "/dashboard/records";
}
