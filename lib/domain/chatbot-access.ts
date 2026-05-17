import { db } from "@/lib/core/db";

export async function getOwnedChatbot(userId: string, chatbotId: string) {
  return db.chatbot.findFirst({
    where: {
      chatbotId,
      userId,
    },
  });
}
