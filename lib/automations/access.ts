import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

/**
 * Every automations route starts here.
 *
 * Two separate things have to be true before a route may touch a rule: the
 * caller must be signed in, and the rule's `workspaceId` must match the
 * workspace they are currently operating in. Collapsing those into one helper
 * means a new route cannot accidentally check the first and forget the second
 * — which is the mistake that leaks one business's rules into another's
 * dashboard.
 */

export interface AutomationScope {
  userId: string;
  workspaceId: string;
  /**
   * `Workspace.userId` — the business owner. Not necessarily the signed-in
   * user when a workspace is shared, which is why it is resolved separately.
   */
  ownerUserId: string;
  /** All `Chatbot.chatbotId` values in this workspace. */
  chatbotIds: string[];
}

export type ScopeResult =
  | { ok: true; scope: AutomationScope }
  | { ok: false; response: NextResponse };

export async function requireAutomationScope(): Promise<ScopeResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const workspace = await getActiveWorkspace(userId);
  const bots = await db.chatbot.findMany({
    where: { userId, workspaceId: workspace.workspaceId },
    select: { chatbotId: true },
  });

  return {
    ok: true,
    scope: {
      userId,
      workspaceId: workspace.workspaceId,
      ownerUserId: workspace.userId,
      chatbotIds: bots.map((bot) => bot.chatbotId),
    },
  };
}

/**
 * Confirm a `chatbotId` belongs to the workspace before storing it on a rule.
 *
 * Without this, a rule could be pinned to another tenant's agent and would
 * then either never fire or — worse — fire against a stranger's conversations
 * the moment `loadEngineRules` ran for that agent.
 */
export function assertChatbotInScope(
  scope: AutomationScope,
  chatbotId: string | null | undefined
): NextResponse | null {
  if (!chatbotId) return null; // NULL is workspace-wide on purpose
  if (scope.chatbotIds.includes(chatbotId)) return null;
  return NextResponse.json(
    { error: "Chatbot not found in the active workspace" },
    { status: 400 }
  );
}

/** Load a rule the caller is allowed to touch, or the response to return. */
export async function findOwnedRule(scope: AutomationScope, automationId: string) {
  const rule = await db.automation.findFirst({
    where: { automationId, workspaceId: scope.workspaceId },
  });
  return rule;
}

/** Strip the client-supplied fields the server owns. */
export function serverOwnedFields() {
  return ["automationId", "id", "workspaceId", "createdAt", "updatedAt", "stats", "lastRunAt"];
}
