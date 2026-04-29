import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';

const db = new PrismaClient();

async function main() {
  const chatbots = await db.chatbot.findMany({ take: 1, orderBy: { createdAt: 'desc' } });
  
  let bot;
  if (chatbots.length === 0) {
    console.log("No chatbots found. Creating a dummy user and chatbot...");
    const dummyUser = await db.user.upsert({
      where: { userId: "user_demo_123" },
      update: {},
      create: { userId: "user_demo_123", email: "demo@driplare.com", name: "Demo User" }
    });
    bot = await db.chatbot.create({
      data: { userId: dummyUser.userId, name: "Demo Chatbot", model: "gpt-4o-mini", avatarColor: "#6d28d9" }
    });
  } else {
    bot = chatbots[0];
  }

  console.log(`Seeding demo analytics data for chatbot: ${bot.name} (${bot.chatbotId})`);

  // Generate 100 fake messages over the last 7 days
  const data = [];
  const roles = ["user", "assistant"];
  
  for (let i = 0; i < 150; i++) {
    const daysAgo = Math.floor(Math.random() * 7); // 0 to 6 days ago
    const date = subDays(new Date(), daysAgo);
    
    // Add random hours
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));

    data.push({
      chatbotId: bot.chatbotId,
      userId: bot.userId,
      sessionId: `session_demo_${Math.floor(Math.random() * 20)}`,
      role: roles[i % 2],
      content: i % 2 === 0 ? "Demo question?" : "Demo response.",
      timestamp: date,
    });
  }

  await db.chatMessage.createMany({ data });
  
  // Create dummy integrations to test Integrations page
  const platforms = ["facebook", "whatsapp", "slack"];
  for (const platform of platforms) {
    await db.integration.upsert({
      where: { chatbotId_platform: { chatbotId: bot.chatbotId, platform } },
      update: {},
      create: {
        chatbotId: bot.chatbotId,
        platform,
        connected: Math.random() > 0.5,
      }
    });
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
