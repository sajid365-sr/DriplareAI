import { db } from "@/lib/db";

export async function getOwnedChatbot(userId: string, chatbotId: string) {
  return db.chatbot.findFirst({
    where: {
      chatbotId,
      userId,
    },
  });
}
