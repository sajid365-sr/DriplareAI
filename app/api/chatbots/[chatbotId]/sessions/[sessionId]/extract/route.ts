import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

// ── GET /api/chatbots/[chatbotId]/sessions/[sessionId]/extract
// Returns the current AI extraction state for a session
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sessionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const session = await db.chatSession.findFirst({
      where: { chatbotId: bot.chatbotId, sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      extraction: session.aiExtractionData ?? {},
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error("[EXTRACT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── POST /api/chatbots/[chatbotId]/sessions/[sessionId]/extract
// Receives AI-extracted data from n8n / LLM and updates the session
// Body: { phone, address, district, product_items, is_order_confirmed }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { chatbotId, sessionId } = await params;
    const body = await req.json();

    // Accept both internal and n8n JSON schema formats
    const {
      phone,
      address,
      district,
      product_items,   // n8n format: [{ name, qty, price }]
      cartItems,       // internal format
      is_order_confirmed,
      orderStatus,     // internal format
    } = body;

    const resolvedItems = product_items ?? cartItems ?? [];
    const confirmed = is_order_confirmed ?? (orderStatus === "confirmed");
    const resolvedStatus = confirmed
      ? "confirmed"
      : phone || address
      ? "details_captured"
      : "browsing";

    // Find the chatbot (no auth check here — this is called by n8n webhook internally)
    // For security, validate with a webhook secret header in production
    const bot = await db.chatbot.findFirst({
      where: { chatbotId },
      select: { chatbotId: true, userId: true },
    });

    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const extractionData = {
      phone: phone ?? null,
      address: address ?? null,
      district: district ?? null,
      cartItems: resolvedItems,
      orderStatus: resolvedStatus,
      orderId: null as string | null,
      courierTrackingId: null as string | null,
    };

    // Update session with AI extracted data
    await db.chatSession.updateMany({
      where: { chatbotId: bot.chatbotId, sessionId },
      data: {
        aiExtractionData: extractionData,
        // Auto-upgrade lead status when details are captured
        ...(resolvedStatus === "details_captured" && { leadStatus: "high_prospect" }),
        ...(resolvedStatus === "confirmed" && { leadStatus: "successful" }),
        updatedAt: new Date(),
      },
    });

    // Auto-dispatch order if confirmed
    if (confirmed && resolvedItems.length > 0) {
      const totalAmount = resolvedItems.reduce(
        (sum: number, item: { price: number; qty: number }) =>
          sum + (item.price ?? 0) * (item.qty ?? 1),
        0
      );

      // Generate unique orderId
      let orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      while (await db.order.findUnique({ where: { orderId } })) {
        orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const trackingNum = Math.floor(10000 + Math.random() * 90000);
      const courierTrackingId = `STEAD-${trackingNum}`;

      // Get customer name from session
      const session = await db.chatSession.findFirst({
        where: { chatbotId: bot.chatbotId, sessionId },
        select: { guestName: true },
      });

      const order = await db.order.create({
        data: {
          orderId,
          chatbotId: bot.chatbotId,
          sessionId,
          customerName: session?.guestName ?? "AI Customer",
          customerPhone: phone ?? null,
          deliveryAddress: address ?? null,
          district: district ?? null,
          items: resolvedItems,
          totalAmount,
          paymentMethod: "COD",
          paymentStatus: "pending",
          courierName: "Steadfast",
          courierTrackingId,
          status: "Processing",
        },
      });

      // Update extraction data with orderId & tracking
      await db.chatSession.updateMany({
        where: { chatbotId: bot.chatbotId, sessionId },
        data: {
          aiExtractionData: {
            ...extractionData,
            orderStatus: "confirmed",
            orderId: order.orderId,
            courierTrackingId,
          },
          leadStatus: "successful",
        },
      });

      return NextResponse.json({
        success: true,
        extraction: { ...extractionData, orderId: order.orderId, courierTrackingId },
        order,
        autoDispatched: true,
      });
    }

    return NextResponse.json({
      success: true,
      extraction: extractionData,
      autoDispatched: false,
    });
  } catch (error) {
    console.error("[EXTRACT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
