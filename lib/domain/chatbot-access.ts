import { db } from "@/lib/core/db";

export async function getOwnedChatbot(userId: string, identifier: string) {
  return db.chatbot.findFirst({
    where: {
      userId,
      OR: [
        { id: identifier },
        { chatbotId: identifier },
      ],
    },
  });
}

/**
 * Access gate for the Live Inbox only. Workspace members can work conversations
 * without gaining access to chatbot configuration or billing APIs.
 */
export async function getInboxAccessibleChatbot(userId: string, identifier: string) {
  const chatbot = await db.chatbot.findFirst({
    where: {
      OR: [{ id: identifier }, { chatbotId: identifier }],
    },
  });

  if (!chatbot) return null;
  if (chatbot.userId === userId) return chatbot;
  if (!chatbot.workspaceId) return null;

  const membership = await db.workspaceMember.findFirst({
    where: {
      workspaceId: chatbot.workspaceId,
      userId,
      status: "active",
    },
    select: { id: true },
  });

  return membership ? chatbot : null;
}
