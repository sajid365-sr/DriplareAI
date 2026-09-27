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
      courierName = "Steadfast",
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

    // Fetch merchant's courier settings if available
    const courierConfig = await db.courierConfig.findUnique({
      where: { userId },
    });

    let courierTrackingId: string | null = null;
    let orderStatus = "Processing";

    // Auto-dispatch to Steadfast if credentials are configured
    if (courierName === "Steadfast" && courierConfig?.steadfastApiKey && courierConfig?.steadfastSecretKey) {
      try {
        let recipientPhone = (resolvedPhone || "").replace(/\D/g, "");
        if (recipientPhone.startsWith("880") && recipientPhone.length === 13) {
          recipientPhone = recipientPhone.substring(2);
        }
        if (recipientPhone.startsWith("1") && recipientPhone.length === 10) {
          recipientPhone = "0" + recipientPhone;
        }

        const fullAddress = [resolvedAddress, district].filter(Boolean).join(", ");

        const sfPayload = {
          invoice: orderId,
          recipient_name: resolvedName,
          recipient_phone: recipientPhone,
          recipient_address: fullAddress || "Dhaka",
          cod_amount: totalAmount,
          note: resolvedNotes || "Order created via Driplare AI",
        };

        const sfRes = await fetch("https://portal.packzy.com/api/v1/create_order", {
          method: "POST",
          headers: {
            "Api-Key": courierConfig.steadfastApiKey,
            "Secret-Key": courierConfig.steadfastSecretKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sfPayload),
        });

        const sfData = await sfRes.json();
        if (sfRes.ok && sfData.status === 200 && sfData.consignment) {
          courierTrackingId = sfData.consignment.tracking_code || String(sfData.consignment.consignment_id);
          orderStatus = "Dispatched";
        } else {
          console.error("Steadfast auto-dispatch response error:", sfData);
        }
      } catch (sfErr) {
        console.error("Steadfast auto-dispatch exception on manual order creation:", sfErr);
      }
    }

    if (!courierTrackingId) {
      const courierPrefix = (courierName || "STEAD").slice(0, 5).toUpperCase();
      const trackingNumber = Math.floor(10000 + Math.random() * 90000);
      courierTrackingId = `${courierPrefix}-${trackingNumber}`;
    }

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
        status: orderStatus,
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
