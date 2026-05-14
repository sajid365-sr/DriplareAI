/**
 * Migration script: Enforce current plan limits for existing users
 * Run: node -r dotenv/config scripts/enforce-limits.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Hardcoding getPlan logic to avoid complex imports in a script
const BD_PLANS = {
  starter: { maxChatbots: 1, maxIntegrations: 1 },
  growth: { maxChatbots: 3, maxIntegrations: 3 },
  business: { maxChatbots: 10, maxIntegrations: 7 },
  enterprise: { maxChatbots: 9999, maxIntegrations: 9999 },
};

async function main() {
  console.log("🔄 Enforcing limits for existing users based on their current plan...");

  try {
    const users = await db.user.findMany({
      select: { userId: true, plan: true }
    });

    for (const user of users) {
      const planLimits = BD_PLANS[user.plan] || BD_PLANS.starter;
      
      // 1. Enforce Chatbot limits
      const activeChatbots = await db.chatbot.findMany({
        where: { userId: user.userId, status: { not: "paused" } },
        orderBy: { createdAt: "asc" },
      });

      if (activeChatbots.length > planLimits.maxChatbots) {
        const toPause = activeChatbots.slice(planLimits.maxChatbots).map(c => c.id);
        await db.chatbot.updateMany({
          where: { id: { in: toPause } },
          data: { status: "paused" }
        });
        console.log(`Paused ${toPause.length} chatbots for user ${user.userId}`);
      }

      // 2. Enforce Integration limits
      const activeIntegrations = await db.integration.findMany({
        where: { chatbot: { userId: user.userId }, connected: true, status: { not: "paused" } },
        orderBy: { connectedAt: "asc" },
      });

      if (activeIntegrations.length > planLimits.maxIntegrations) {
        const toPause = activeIntegrations.slice(planLimits.maxIntegrations).map(i => i.id);
        await db.integration.updateMany({
          where: { id: { in: toPause } },
          data: { connected: false, status: "paused" }
        });
        console.log(`Paused ${toPause.length} integrations for user ${user.userId}`);
      }
    }

    console.log("✅ All limits enforced successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await db.$disconnect();
  }
}

main();
