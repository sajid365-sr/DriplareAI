import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";
import { timingSafeEqualString } from "@/lib/core/timing-safe";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";
import {
  resolveItemsAgainstCatalogue,
  sumItems,
  type CatalogueProduct,
} from "@/lib/domain/order-schema";

/**
 * POST /api/internal/orders/modify — Feature #19: Pre-confirm Order Modification
 *
 * VideoScript: "ঠিকানা, ফোন নম্বর, আরেকটা product যোগ, সংখ্যা কম বেশি...
 *               Agent নিজেই করে দেয় আর নতুন bill পাঠিয়ে দেয়।"
 *
 * When a customer asks to modify their pending order through chat (before it's
 * confirmed by the merchant team), the AI updates the order in the DB and
 * dispatches an updated bill back to the customer's chat.
 */

const modifyItemSchema = z.object({
  productId: z.string().max(200).optional(),
  name: z.string().min(1).max(255),
  qty: z.number().int().positive(),
  price: z.number().nonnegative().optional(),
});

const modifyRequestSchema = z.object({
  chatbotId: z.string().min(1).max(200),
  sessionId: z.string().min(1).max(200),
  orderId: z.string().max(100).optional(),
  customerName: z.string().min(1).max(255).optional(),
  customerPhone: z.string().min(1).max(32).optional(),
  deliveryAddress: z.string().min(1).max(1000).optional(),
  district: z.string().max(100).optional(),
  items: z.array(modifyItemSchema).optional(),
  totalAmount: z.number().nonnegative().optional(),
  reason: z.string().max(500).optional(),
  sendNewBill: z.boolean().default(true),
});

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTERNAL_ORDER_MODIFY] N8N_CALLBACK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const headerSecret = req.headers.get("x-n8n-secret");
  if (!headerSecret || !timingSafeEqualString(headerSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = modifyRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
        { status: 200 }
      );
    }

    const input = parsed.data;

    // ── Find Order ───────────────────────────────────────────────────────────
    const order = input.orderId
      ? await db.order.findUnique({
          where: { orderId: input.orderId },
          include: { chatbot: { select: { userId: true, chatbotId: true } } },
        })
      : await db.order.findFirst({
          where: {
            chatbotId: input.chatbotId,
            sessionId: input.sessionId,
          },
          orderBy: { createdAt: "desc" },
          include: { chatbot: { select: { userId: true, chatbotId: true } } },
        });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          reason: "order_not_found",
          message: "No order was found to modify for this conversation.",
        },
        { status: 200 }
      );
    }

    // ── Pre-confirm check ────────────────────────────────────────────────────
    // Only pre-confirm orders (Processing / Pending) can be modified directly by AI.
    // If the order is already confirmed, dispatched, or delivered, the AI must not
    // silently alter it — it must route a change request to the team (Feature #20).
    const normalizedStatus = (order.status || "processing").toLowerCase();
    const isPreConfirm =
      normalizedStatus === "processing" || normalizedStatus === "pending";

    if (!isPreConfirm) {
      return NextResponse.json(
        {
          success: false,
          reason: "order_already_confirmed",
          status: order.status,
          message:
            "This order has already been confirmed or shipped. Changes cannot be applied automatically; routing to human support.",
        },
        { status: 200 }
      );
    }

    // ── Items & Price Resolution ─────────────────────────────────────────────
    let finalItems = order.items;
    let finalTotal = order.totalAmount;

    if (input.items && input.items.length > 0) {
      const productIds = [
        ...new Set(
          input.items
            .map((i) => i.productId)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const catalogue: CatalogueProduct[] = productIds.length
        ? await db.product.findMany({
            where: {
              chatbotId: input.chatbotId,
              productId: { in: productIds },
            },
            select: { productId: true, name: true, price: true, isActive: true },
          })
        : [];

      // Fill in default price if missing
      const itemsToResolve = input.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        price: i.price ?? 0,
      }));

      const resolution = resolveItemsAgainstCatalogue(itemsToResolve, catalogue);
      if (resolution.ok) {
        finalItems = resolution.items;
        finalTotal = sumItems(resolution.items) + order.deliveryFee;
      } else {
        finalItems = itemsToResolve;
        finalTotal =
          input.totalAmount !== undefined
            ? input.totalAmount
            : itemsToResolve.reduce((acc, it) => acc + (it.price || 0) * it.qty, 0) +
              order.deliveryFee;
      }
    } else if (input.totalAmount !== undefined) {
      finalTotal = input.totalAmount;
    }

    // ── Audit Modification History ───────────────────────────────────────────
    const history = Array.isArray(order.modificationHistory)
      ? (order.modificationHistory as Record<string, unknown>[])
      : [];

    const historyEntry = {
      modifiedAt: new Date().toISOString(),
      modifiedBy: "ai_agent",
      reason: input.reason || "Customer chat change request",
      previous: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        district: order.district,
        items: order.items,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
      },
      updated: {
        ...(input.customerName && { customerName: input.customerName }),
        ...(input.customerPhone && { customerPhone: input.customerPhone }),
        ...(input.deliveryAddress && { deliveryAddress: input.deliveryAddress }),
        ...(input.district && { district: input.district }),
        ...(input.items && { items: finalItems, totalAmount: finalTotal }),
      },
    };

    // ── Update Order in DB ───────────────────────────────────────────────────
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        ...(input.customerName && { customerName: input.customerName }),
        ...(input.customerPhone && { customerPhone: input.customerPhone }),
        ...(input.deliveryAddress && { deliveryAddress: input.deliveryAddress }),
        ...(input.district && { district: input.district }),
        items: finalItems as unknown as Prisma.InputJsonValue,
        totalAmount: finalTotal,
        modificationHistory: [...history, historyEntry] as unknown as Prisma.InputJsonValue,
      },
    });

    // ── Dispatch Updated Bill to Chat ────────────────────────────────────────
    let billMessage = "";
    if (input.sendNewBill) {
      const itemsList = Array.isArray(updated.items)
        ? (updated.items as { name: string; qty: number; price?: number }[])
            .map((item) => `• ${item.name} × ${item.qty}${item.price ? ` — ৳${item.price * item.qty}` : ""}`)
            .join("\n")
        : "";

      billMessage =
        `📝 আপনার অর্ডারের তথ্য সফলভাবে আপডেট করা হয়েছে!\n\n` +
        `অর্ডার আইডি: #${updated.orderId}\n` +
        `পণ্যসমূহ:\n${itemsList}\n\n` +
        `মোট টাকা: ৳${updated.totalAmount}\n` +
        `📍 ডেলিভারি ঠিকানা: ${updated.deliveryAddress || "দেওয়া হয়নি"}${updated.district ? `, ${updated.district}` : ""}\n` +
        `📞 ফোন নম্বর: ${updated.customerPhone || "দেওয়া হয়নি"}\n\n` +
        `সংশোধিত ইনভয়েস গ্রহণ করা হয়েছে। আর কিছু পরিবর্তন করতে চাইলে জানাতে পারেন!`;

      try {
        await deliverInboxMessage({
          botIds: [order.chatbotId],
          sessionId: input.sessionId,
          text: billMessage,
        });

        await db.chatMessage.create({
          data: {
            chatbotId: order.chatbotId,
            userId: order.chatbot.userId,
            sessionId: input.sessionId,
            role: "assistant",
            content: billMessage,
            sentByHuman: false,
            mediaType: "text",
          },
        });
      } catch (err) {
        console.error("[INTERNAL_ORDER_MODIFY_BILL_DELIVERY_ERROR]", err);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: updated.orderId,
      totalAmount: updated.totalAmount,
      items: updated.items,
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      deliveryAddress: updated.deliveryAddress,
      district: updated.district,
      billSent: input.sendNewBill,
      billMessage,
    });
  } catch (error) {
    console.error("[INTERNAL_ORDER_MODIFY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
