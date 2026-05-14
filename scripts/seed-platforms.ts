import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const platforms = [
  {
    platformId: "facebook",
    name: "Facebook Messenger",
    description: "Connect your chatbot to your Facebook Page. Powered by n8n automation.",
    iconKey: "facebook",
    color: "#1877F2",
    category: "social",
    order: 1
  },
  {
    platformId: "whatsapp",
    name: "WhatsApp Business",
    description: "Deploy your AI assistant to WhatsApp.",
    iconKey: "whatsapp",
    color: "#25D366",
    category: "messaging",
    order: 2
  },
  {
    platformId: "instagram",
    name: "Instagram",
    description: "Answer DMs and comments on Instagram.",
    iconKey: "instagram",
    color: "#E4405F",
    category: "social",
    order: 3
  },
  {
    platformId: "tiktok",
    name: "TikTok",
    description: "Automate responses on TikTok.",
    iconKey: "tiktok",
    color: "#000000",
    category: "social",
    order: 4
  },
  {
    platformId: "website",
    name: "Website Widget",
    description: "Embed a chat bubble on your website.",
    iconKey: "website",
    color: "#6d28d9",
    category: "website",
    order: 5
  },
  {
    platformId: "slack",
    name: "Slack",
    description: "Answer questions in Slack channels.",
    iconKey: "slack",
    color: "#4A154B",
    isComingSoon: true,
    category: "messaging",
    order: 6
  },
  {
    platformId: "telegram",
    name: "Telegram",
    description: "Deploy as a Telegram bot.",
    iconKey: "telegram",
    color: "#229ED9",
    isComingSoon: true,
    category: "messaging",
    order: 7
  },
  {
    platformId: "webhook",
    name: "Custom Webhook",
    description: "Connect to anything using Webhooks.",
    iconKey: "webhook",
    color: "#f97316",
    category: "automation",
    order: 8
  },
  {
    platformId: "custom_api",
    name: "REST API",
    description: "Build your own custom client.",
    iconKey: "custom_api",
    color: "#3b82f6",
    category: "automation",
    order: 9
  }
];

async function main() {
  console.log("Seeding platforms...");
  for (const p of platforms) {
    await prisma.availablePlatform.upsert({
      where: { platformId: p.platformId },
      update: p,
      create: p,
    });
  }
  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
