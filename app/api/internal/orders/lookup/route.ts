import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { timingSafeEqualString } from "@/lib/core/timing-safe";

const lookupSchema = z.object({
  chatbotId: z.string().trim().min(1).max(200),
  orderId: z.string().trim().min(1).max(100),
  customerPhone: z.string().trim().min(7).max(32),
});

function normalizeBangladeshPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^008801\d{9}$/.test(digits)) return digits.slice(5);
  if (/^8801\d{9}$/.test(digits)) return digits.slice(3);
  if (/^01\d{9}$/.test(digits)) return digits.slice(1);
  return digits;
}

/** Returns order status only after the customer verifies the order phone. */
export async function POST(request: Request) {
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTERNAL_ORDER_LOOKUP] N8N_CALLBACK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!timingSafeEqualString(request.headers.get("x-n8n-secret"), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Order ID and the phone number used at checkout are required" }, { status: 400 });
  }

  try {
    const { chatbotId, orderId, customerPhone } = parsed.data;
    const bot = await db.chatbot.findUnique({
      where: { chatbotId },
      select: { chatbotId: true, workspaceId: true },
    });
    if (!bot) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const workspaceBotIds = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: bot.chatbotId }];
    const botIds = workspaceBotIds.map((agent) => agent.chatbotId);
    const order = await db.order.findFirst({
      where: {
        orderId,
        OR: bot.workspaceId
          ? [
              { workspaceId: bot.workspaceId },
              { workspaceId: null, chatbotId: { in: botIds } },
            ]
          : [{ chatbotId: bot.chatbotId }],
      },
      select: {
        orderId: true,
        customerPhone: true,
        items: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        courierName: true,
        courierTrackingId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (
      !order?.customerPhone ||
      normalizeBangladeshPhone(order.customerPhone) !== normalizeBangladeshPhone(customerPhone)
    ) {
      return NextResponse.json({ error: "Order not found. Check the order ID and phone number." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        status: order.status,
        courierName: order.courierName,
        courierTrackingId: order.courierTrackingId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[INTERNAL_ORDER_LOOKUP]", error);
    return NextResponse.json({ error: "Could not look up order" }, { status: 500 });
  }
}
