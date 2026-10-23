import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";

const placeOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  customerPhone: z.string().trim().min(6, "Valid phone number is required").max(20),
  deliveryAddress: z.string().trim().min(5, "Detailed address is required").max(500),
  district: z.string().trim().max(100).optional(),
  quantity: z.number().int().min(1).max(50).default(1),
  variant: z.record(z.string(), z.string()).optional(),
  paymentMethod: z.string().default("COD"),
  deliveryFee: z.number().min(0).default(60),
  sessionId: z.string().trim().optional(),
  channel: z.string().trim().optional(),
});

/**
 * POST /api/p/[productId]/order
 * Feature #11: Native Product Page (Chat-native Checkout)
 *
 * Public endpoint for chat customers to submit direct orders without creating an account.
 * Automatically saves the Order and sends confirmation + bill back into the customer's chat session.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = placeOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order details", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      customerName,
      customerPhone,
      deliveryAddress,
      district,
      quantity,
      variant,
      paymentMethod,
      deliveryFee,
      sessionId,
      channel,
    } = parsed.data;

    // 1. Fetch product & chatbot owner
    const product = await db.product.findUnique({
      where: { productId },
      include: {
        chatbot: {
          select: { userId: true, chatbotId: true },
        },
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Product is not available" }, { status: 404 });
    }

    // 2. Generate unique human-readable order ID
    const orderId = `ORD-${randomBytes(4).toString("hex").toUpperCase()}`;
    const unitPrice = product.price ?? 0;
    const subtotal = unitPrice * quantity;
    const totalAmount = subtotal + deliveryFee;

    // 3. Create the Order in DB
    const order = await db.order.create({
      data: {
        orderId,
        chatbotId: product.chatbotId,
        sessionId: sessionId || `p_${orderId.toLowerCase()}`,
        customerName,
        customerPhone,
        deliveryAddress,
        district: district || null,
        items: [
          {
            productId: product.productId,
            name: product.name,
            price: unitPrice,
            qty: quantity,
            variant: variant || null,
          },
        ],
        deliveryFee,
        totalAmount,
        paymentMethod: paymentMethod || "COD",
        paymentStatus: "pending",
        status: "Processing",
        internalNotes: `Native Chat Checkout via ${channel || "web"}`,
      },
    });

    // 4. Safely decrement stock if tracked
    if (typeof product.stock === "number" && product.stock > 0) {
      try {
        await db.product.update({
          where: { productId },
          data: { stock: { decrement: quantity } },
        });
      } catch (stockErr) {
        console.warn("[PRODUCT_STOCK_DECREMENT]", stockErr);
      }
    }

    // 5. Send order confirmation & itemized bill to chat if sessionId is provided
    if (sessionId) {
      const variantParts: string[] = [];
      if (variant?.size) variantParts.push(`Size: ${variant.size}`);
      if (variant?.color) variantParts.push(`Color: ${variant.color}`);
      for (const [key, val] of Object.entries(variant || {})) {
        if (key !== "size" && key !== "color" && val) {
          variantParts.push(`${key}: ${val}`);
        }
      }
      const variantStr = variantParts.length > 0 ? ` (${variantParts.join(", ")})` : "";

      const billMessage =
        `🎉 অর্ডার কনফার্মেশন (#${order.orderId})\n\n` +
        `🛍️ পণ্য: ${product.name}${variantStr}\n` +
        `📦 পরিমাণ: ${quantity}\n` +
        `💰 পণ্য মূল্য: ৳${subtotal.toLocaleString()}\n` +
        `🚚 ডেলিভারি চার্জ: ৳${deliveryFee}\n` +
        `💳 সর্বমোট বিল: ৳${totalAmount.toLocaleString()}\n` +
        `📍 ডেলিভারি ঠিকানা: ${deliveryAddress}${district ? `, ${district}` : ""}\n` +
        `📞 ফোন: ${customerPhone}\n` +
        `🏷️ পেমেন্ট: ${paymentMethod === "COD" ? "Cash on Delivery" : paymentMethod}\n\n` +
        `আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে! ধন্যবাদ।`;

      try {
        // Dispatch to messaging platform (Messenger, WhatsApp, Instagram, or Web)
        await deliverInboxMessage({
          botIds: [product.chatbotId],
          sessionId,
          text: billMessage,
        });

        // Mirror to ChatMessage table for inbox visibility
        await db.chatMessage.create({
          data: {
            chatbotId: product.chatbotId,
            userId: product.chatbot.userId,
            sessionId,
            role: "assistant",
            content: billMessage,
            sentByHuman: false,
            mediaType: "text",
          },
        });
      } catch (deliveryErr) {
        console.error("[NATIVE_ORDER_DELIVERY_ERROR]", deliveryErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      totalAmount,
      order,
    });
  } catch (error) {
    console.error("[NATIVE_PRODUCT_ORDER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to place order" },
      { status: 500 }
    );
  }
}

