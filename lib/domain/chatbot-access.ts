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
