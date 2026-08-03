import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// Helper to generate human-readable Order ID (e.g., ORD-9482)
function generateOrderId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${num}`;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    // Find chatbots in the active business/workspace
    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });

    const botIds = Array.from(
      new Set(userBots.flatMap((b) => [b.id, b.chatbotId]))
    );

    const isAll = url.searchParams.get("all") === "true";

    // If sessionId is given
    if (sessionId) {
      if (isAll) {
        const orders = await db.order.findMany({
          where: {
            chatbotId: { in: botIds },
            sessionId,
          },
          orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ success: true, orders });
      }

      const order = await db.order.findFirst({
        where: {
          chatbotId: { in: botIds },
          sessionId,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, order: order ?? null });
    }

    const orders = await db.order.findMany({
      where: {
        chatbotId: { in: botIds },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("[ORDERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      chatbotId,
      sessionId,
      customerName,
      name,
      customerPhone,
      phone,
      deliveryAddress,
      address,
      district,
      items,
      quantity,
      product,
      courierName,
      paymentMethod = "COD",
      internalNotes,
      notes,
    } = body;

    const resolvedName = customerName || name || "Valued Customer";
    const resolvedPhone = customerPhone || phone || null;
    const resolvedAddress = deliveryAddress || address || null;
    const resolvedNotes = internalNotes || notes || null;

    // Calculate total amount from items array or legacy calculation
    let resolvedItems: { name: string; qty: number; price: number }[] = [];
    let totalAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      resolvedItems = items;
      totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    } else {
      // Legacy single-product fallback
      const qtyNumber = parseInt(quantity || "1", 10);
      const unitPrice = 1850;
      totalAmount = unitPrice * qtyNumber;
      resolvedItems = [
        {
          name: product || "Starter Package",
          qty: qtyNumber,
          price: unitPrice,
        },
      ];
    }

    // Resolve target Chatbot — must belong to the active workspace
    const workspace = await getActiveWorkspace(userId);
    const bot = await db.chatbot.findFirst({
      where: {
        userId,
        workspaceId: workspace.workspaceId,
        ...(chatbotId
          ? { OR: [{ id: chatbotId }, { chatbotId: chatbotId }] }
          : {}),
      },
    });

    if (!bot) {
      return NextResponse.json(
        { error: "No chatbot found for this business" },
        { status: 400 }
      );
    }

    const targetChatbotId = bot.chatbotId;
    const resolvedSessionId = sessionId || `manual-${Date.now()}`;

    // Generate unique orderId
    let orderId = generateOrderId();
    while (await db.order.findUnique({ where: { orderId } })) {
      orderId = generateOrderId();
    }

    // Generate mock courier tracking ID
    const courierPrefix = (courierName || "STEAD").slice(0, 5).toUpperCase();
    const trackingNumber = Math.floor(10000 + Math.random() * 90000);
    const courierTrackingId = `${courierPrefix}-${trackingNumber}`;

    // Ensure ChatSession exists for foreign key relation
    await db.chatSession.upsert({
      where: {
        chatbotId_sessionId: {
          chatbotId: targetChatbotId,
          sessionId: resolvedSessionId,
        },
      },
      create: {
        chatbotId: targetChatbotId,
        sessionId: resolvedSessionId,
        guestName: resolvedName,
        platform: "web",
        isActive: true,
        leadStatus: "successful",
        aiExtractionData: {
          phone: resolvedPhone,
          address: resolvedAddress,
          district: district || null,
          cartItems: resolvedItems,
          orderStatus: "confirmed",
          orderId,
          courierTrackingId,
        },
      },
      update: {
        leadStatus: "successful",
        aiExtractionData: {
          phone: resolvedPhone,
          address: resolvedAddress,
          district: district || null,
          cartItems: resolvedItems,
          orderStatus: "confirmed",
          orderId,
          courierTrackingId,
        },
      },
    });

    // Create Order
    const newOrder = await db.order.create({
      data: {
        orderId,
        chatbotId: targetChatbotId,
        sessionId: resolvedSessionId,
        customerName: resolvedName,
        customerPhone: resolvedPhone,
        deliveryAddress: resolvedAddress,
        district: district || null,
        items: resolvedItems,
        totalAmount,
        paymentMethod,
        paymentStatus: "pending",
        courierName: courierName || "Steadfast",
        courierTrackingId,
        status: "Processing",
        internalNotes: resolvedNotes,
      },
    });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error: any) {
    console.error("[ORDERS_POST]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
