import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

/** POST /api/internal/orders/change-request
 * Records a post-confirm change request from the AI agent.
 * Flags the chat session as a support ticket for the merchant.
 */
export async function POST(req: Request) {
  try {
    // Verify internal secret for security
    const secret = req.headers.get("x-internal-secret");
    if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      chatbotId: string;
      sessionId: string;
      orderId: string;
      requestedChanges: string;
      customerPhone?: string;
      note?: string;
    };

    const { chatbotId, sessionId, orderId, requestedChanges, customerPhone, note } = body;

    if (!chatbotId || !sessionId || !orderId || !requestedChanges) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the order
    const order = await db.order.findFirst({
      where: { orderId, chatbotId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow post-confirm orders (reject if still in pre-confirm Processing/Pending state)
    if (order.status === "Processing") {
      return NextResponse.json(
        { error: "Order is still in pre-confirm status. Use the modify endpoint instead." },
        { status: 400 }
      );
    }

    // Append to changeRequests JSON array
    const existingRequests = Array.isArray(order.changeRequests) ? order.changeRequests : [];
    const newRequest = {
      requestedAt: new Date().toISOString(),
      requestedChanges,
      customerPhone: customerPhone ?? order.customerPhone ?? null,
      note: note ?? null,
      status: "pending",
    };
    const updatedRequests = [...existingRequests, newRequest];

    // Update order changeRequests in DB
    await db.order.update({
      where: { id: order.id },
      data: { changeRequests: updatedRequests },
    });

    // Flag the chat session as needing merchant attention
    await db.chatSession.updateMany({
      where: { chatbotId, sessionId },
      data: {
        topic: `Order Change Request: #${order.orderId}`,
        isAiBlocked: true,
      },
    });

    // Create an internal conversation note for the merchant
    const noteText = [
      `📋 **Post-confirm Change Request for Order #${order.orderId}**`,
      `Customer: ${order.customerName}${customerPhone ? ` (${customerPhone})` : ""}`,
      `Requested Change: ${requestedChanges}`,
      note ? `Additional Note: ${note}` : null,
      `Submitted at: ${new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}`,
    ]
      .filter(Boolean)
      .join("\n");

    await db.conversationNote.create({
      data: {
        chatbotId,
        sessionId,
        source: "automation",
        text: noteText,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CHANGE_REQUEST_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
