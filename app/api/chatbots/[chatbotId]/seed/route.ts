import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const now = Date.now();
    const min = 60 * 1000;

    const demoSessions = [
      {
        sessionId: `demo-fb-${chatbotId.slice(-4)}-01`,
        platform: "facebook",
        guestName: "Tanvir Hossain",
        profilePhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        leadStatus: "high_prospect",
        isActive: true,
        lastMessage: "আপনার ফোন নম্বর এবং ডেলিভারি অ্যাড্রেসটি প্রদান করুন, আমাদের প্রতিনিধি অর্ডারটি কনফার্ম করে দেবে। 📦",
        sentiment: "positive",
        topic: "Driplare Premium Package Order",
        updatedAt: new Date(now - 10 * min),
        messages: [
          {
            role: "user",
            content: "হ্যালো, Driplare Premium Package এর সার্ভিস প্রাইস কত এবং কি কি ফিচার পাওয়া যাবে?",
            timestamp: new Date(now - 25 * min),
          },
          {
            role: "assistant",
            content: "হ্যালো তানভীর সাহেব! Driplare Premium Package-এ আপনি পাচ্ছেন Omnichannel AI Chatbot (Facebook, WhatsApp, Instagram), Live Agent Handoff, auto order creation এবং Unlimited message capabilities. বর্তমানে আমাদের ২০% ডিসকাউন্ট অফার চলছে! 🏷️ মূল্য মাত্র ৪,৯৯৯ টাকা/মাস।",
            timestamp: new Date(now - 24 * min),
          },
          {
            role: "user",
            content: "খুব সুন্দর! আমি কিভাবে অর্ডার প্লেস করতে পারি?",
            timestamp: new Date(now - 20 * min),
          },
          {
            role: "assistant",
            content: "আপনি সরাসরি এখান থেকেই অর্ডার প্লেস করতে পারেন। আপনার ফোন নম্বর এবং ডেলিভারি অ্যাড্রেসটি প্রদান করুন, আমাদের প্রতিনিধি অর্ডারটি কনফার্ম করে দেবে। 📦",
            timestamp: new Date(now - 18 * min),
          },
        ],
      },
      {
        sessionId: `demo-wa-${chatbotId.slice(-4)}-02`,
        platform: "whatsapp",
        guestName: "Nusrat Jahan",
        profilePhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
        leadStatus: "priority",
        isActive: true,
        lastMessage: "Awesome choice! 📦 Please share your delivery address & contact number so we can process the COD order.",
        sentiment: "positive",
        topic: "Cash On Delivery & AI Toolkit",
        updatedAt: new Date(now - 30 * min),
        messages: [
          {
            role: "user",
            content: "Hi! Do you have Cash on Delivery available for Dhaka area?",
            timestamp: new Date(now - 45 * min),
          },
          {
            role: "assistant",
            content: "Hello Nusrat! Yes, we offer Cash on Delivery (COD) all across Bangladesh including Dhaka city. Delivery time for Dhaka is 24-48 hours. 🚚",
            timestamp: new Date(now - 44 * min),
          },
          {
            role: "user",
            content: "Great! I want to order 2 units of your AI Automation Toolkit.",
            timestamp: new Date(now - 40 * min),
          },
          {
            role: "assistant",
            content: "Awesome choice! 📦 Please share your delivery address & contact number so we can process the COD order for 2 units right away.",
            timestamp: new Date(now - 38 * min),
          },
        ],
      },
      {
        sessionId: `demo-ig-${chatbotId.slice(-4)}-03`,
        platform: "instagram",
        guestName: "Rahim Chowdhury",
        profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        leadStatus: "risky",
        isActive: false, // Inactive / Manual Agent Mode
        lastMessage: "Hello Rahim, human support agent here! I've checked your account and fixed the promo code 'DRIPLARE10'. Please try again now.",
        sentiment: "neutral",
        topic: "Promo Code Support",
        updatedAt: new Date(now - 60 * min),
        messages: [
          {
            role: "user",
            content: "Hey! Is there any active promo code or voucher for Instagram followers?",
            timestamp: new Date(now - 120 * min),
          },
          {
            role: "assistant",
            content: "Hello Rahim! Yes, use promo code 'DRIPLARE10' at checkout to get an extra 10% OFF on all plans! 🎉",
            timestamp: new Date(now - 115 * min),
          },
          {
            role: "user",
            content: "The promo code gave me an error at checkout.",
            timestamp: new Date(now - 90 * min),
          },
          {
            role: "assistant",
            content: "Hello Rahim, human support agent here! I've checked your account and fixed the promo code 'DRIPLARE10'. Please try again now.",
            timestamp: new Date(now - 70 * min),
          },
        ],
      },
      {
        sessionId: `demo-web-${chatbotId.slice(-4)}-04`,
        platform: "web",
        guestName: "Sadia Rahman",
        profilePhoto: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
        leadStatus: "successful",
        isActive: true,
        lastMessage: "Hi Sadia! Yes, Driplare AI natively integrates with Google Sheets. All orders placed are automatically synced!",
        sentiment: "positive",
        topic: "Google Sheets Integration",
        updatedAt: new Date(now - 180 * min),
        messages: [
          {
            role: "user",
            content: "Hello, can I integrate Driplare AI with Google Sheets for order sync?",
            timestamp: new Date(now - 190 * min),
          },
          {
            role: "assistant",
            content: "Hi Sadia! Yes, Driplare AI natively integrates with Google Sheets. All orders placed via Facebook, WhatsApp, or Web are automatically synced to your Google Sheet in real-time! 📊",
            timestamp: new Date(now - 185 * min),
          },
        ],
      },
    ];

    // Target bot's unique chatbotId for foreign key relations in Neon DB
    const targetChatbotId = bot.chatbotId;

    // Insert or update sessions & messages in Neon DB
    for (const sessionData of demoSessions) {
      const { messages, ...sessionMeta } = sessionData;

      await db.chatSession.upsert({
        where: {
          chatbotId_sessionId: {
            chatbotId: targetChatbotId,
            sessionId: sessionMeta.sessionId,
          },
        },
        create: {
          chatbotId: targetChatbotId,
          ...sessionMeta,
        },
        update: {
          ...sessionMeta,
        },
      });

      // Insert messages for session
      for (const msg of messages) {
        // Check if message exists or insert
        const existing = await db.chatMessage.findFirst({
          where: {
            chatbotId: targetChatbotId,
            sessionId: sessionMeta.sessionId,
            content: msg.content,
          },
        });

        if (!existing) {
          await db.chatMessage.create({
            data: {
              chatbotId: targetChatbotId,
              userId,
              sessionId: sessionMeta.sessionId,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demo chat sessions and messages successfully seeded into Neon DB",
    });
  } catch (error) {
    console.error("[SEED_POST]", error);
    return NextResponse.json({ error: "Failed to seed demo data" }, { status: 500 });
  }
}
