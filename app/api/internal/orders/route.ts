import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { db } from "@/lib/core/db";
import { isUniqueViolation } from "@/lib/core/prisma-errors";
import { timingSafeEqualString } from "@/lib/core/timing-safe";
import {
  ORDER_LIMITS,
  createOrderRequestSchema,
  finalizeOrder,
  normalizeOrderPayload,
  resolveItemsAgainstCatalogue,
  sumItems,
  type CatalogueProduct,
  type OrderValidationIssue,
} from "@/lib/domain/order-schema";

/**
 * POST /api/internal/orders — the only path that writes an `Order`.
 *
 * Called by n8n's `Create Order` tool through the shared `x-n8n-secret` header
 * (`/api/internal/*` is Clerk-exempt in `proxy.ts` for exactly this).
 *
 * Before this endpoint existed, the tool ran its own `INSERT` with the model's
 * output interpolated straight into SQL — which meant an unvalidated phone
 * number, an address the customer never finished giving, and an invented price
 * could all land in `ecommerce.Order` as a confirmed sale. Now the model sends a
 * request and this route decides whether it becomes an order.
 *
 * ### Why business failures answer `200 { success: false }`
 * n8n turns a non-2xx response into a failed tool node, and the agent sees an
 * opaque transport error instead of the reason. Answering 200 with a reason lets
 * the agent read it as a normal tool result and go back to the customer to ask
 * for the missing piece. Non-2xx is reserved for things the model cannot fix:
 * auth (401), a malformed body (400), and server faults (500).
 */

/** How many times to retry the insert if the random `orderId` collides. */
const ORDER_ID_ATTEMPTS = 3;

/** Customer-facing order handle, e.g. `ORD-3F9A1C04`. */
function generateOrderId(): string {
  // `randomBytes`, not `Math.random`: the order id is a customer-facing handle,
  // so it must not be guessable from the previous one. Eight hex characters is
  // 4.3 billion values, where the six the old SQL used was only 16.7 million —
  // small enough that collisions were a matter of time, not luck.
  return `ORD-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** A rejection the model can act on. Always HTTP 200 — see the note above. */
function rejected(reason: string, issues?: OrderValidationIssue[]) {
  return NextResponse.json({ success: false, reason, ...(issues ? { issues } : {}) });
}

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    // Fails shut, not open: an unauthenticated endpoint that can create orders
    // in any merchant's store is far worse than an order that is not created.
    console.error("[INTERNAL_ORDERS] N8N_CALLBACK_SECRET is not set — endpoint closed");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!timingSafeEqualString(req.headers.get("x-n8n-secret"), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Body ─────────────────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createOrderRequestSchema.safeParse(normalizeOrderPayload(rawBody));
    if (!parsed.success) {
      const issues: OrderValidationIssue[] = parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(body)",
        message: issue.message,
      }));
      console.warn("[INTERNAL_ORDERS] schema rejection", { fields: issues.map((i) => i.field) });
      return rejected(
        `The order details are not usable: ${issues.map((i) => `${i.field} — ${i.message}`).join("; ")}`,
        issues
      );
    }

    const input = parsed.data;

    // ── Cross-field rules ────────────────────────────────────────────────────
    const finalized = finalizeOrder(input);
    if (!finalized.ok) {
      console.warn("[INTERNAL_ORDERS] rule rejection", {
        chatbotId: input.chatbotId,
        fields: finalized.issues.map((i) => i.field),
      });
      return rejected(
        `The order was not created: ${finalized.issues.map((i) => i.message).join(" ")} Ask the customer for the missing or corrected details, then try again.`,
        finalized.issues
      );
    }

    // ── Ownership ────────────────────────────────────────────────────────────
    // The `Order` foreign key alone would accept any well-formed `chatbotId`,
    // including one naming somebody else's store. Resolving it here is what ties
    // the write to a real chatbot.
    const chatbot = await db.chatbot.findUnique({
      where: { chatbotId: input.chatbotId },
      select: { chatbotId: true, name: true, workspaceId: true },
    });
    if (!chatbot) {
      return rejected(`Unknown chatbotId "${input.chatbotId}".`);
    }

    const session = await db.chatSession.findUnique({
      where: { chatbotId_sessionId: { chatbotId: input.chatbotId, sessionId: input.sessionId } },
      select: { sessionId: true, integrationId: true },
    });
    if (!session) {
      return rejected(
        `Unknown sessionId "${input.sessionId}" for this chatbot. The order must belong to an existing conversation.`
      );
    }

    // ── Catalogue ────────────────────────────────────────────────────────────
    // Scoped by `chatbotId`, so a `productId` from another workspace resolves to
    // nothing and is rejected — the same handling a hallucinated id gets.
    const productIds = [
      ...new Set(
        finalized.order.items
          .map((item) => item.productId)
          .filter((productId): productId is string => Boolean(productId))
      ),
    ];

    const catalogue: CatalogueProduct[] = productIds.length
      ? await db.product.findMany({
          where: { chatbotId: input.chatbotId, productId: { in: productIds } },
          select: { productId: true, name: true, price: true, isActive: true, imageUrl: true, imageUrls: true },
        })
      : [];

    // n8n/LLM tool arguments can occasionally contain a stale or invented ID.
    // Recover only when the exact product name resolves to one active product
    // in this chatbot's own catalogue; prices and images still come from that
    // canonical row. Ambiguous names remain rejected below.
    const knownProductIds = new Set(catalogue.map((product) => product.productId));
    const unresolvedItems = finalized.order.items.filter(
      (item) => item.productId && !knownProductIds.has(item.productId)
    );
    const unresolvedNames = [...new Set(unresolvedItems.map((item) => item.name.trim()))];
    const fallbackProducts: CatalogueProduct[] = unresolvedNames.length
      ? await db.product.findMany({
          where: {
            chatbotId: input.chatbotId,
            isActive: true,
            OR: unresolvedNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
          },
          select: { productId: true, name: true, price: true, isActive: true, imageUrl: true, imageUrls: true },
        })
      : [];

    const normalizedName = (name: string) => name.trim().toLocaleLowerCase();
    const remappedItems = finalized.order.items.map((item) => {
      if (!item.productId || knownProductIds.has(item.productId)) return item;

      const matches = fallbackProducts.filter(
        (product) => normalizedName(product.name) === normalizedName(item.name)
      );
      return matches.length === 1 ? { ...item, productId: matches[0].productId } : item;
    });
    const resolutionCatalogue = [...catalogue, ...fallbackProducts];

    const resolution = resolveItemsAgainstCatalogue(remappedItems, resolutionCatalogue);
    if (!resolution.ok) {
      console.warn("[INTERNAL_ORDERS] catalogue rejection", {
        chatbotId: input.chatbotId,
        reason: resolution.reason,
      });
      return rejected(`The order was not created: ${resolution.reason}`);
    }

    // Recompute against live catalogue prices. If a product price changed since
    // the assistant quoted the order, require a new customer confirmation.
    const itemsSubtotal = sumItems(resolution.items);
    const deliveryFee = finalized.order.deliveryFee;
    const totalAmount = Math.round((itemsSubtotal + deliveryFee) * 100) / 100;
    if (
      input.totalAmount !== undefined &&
      Math.abs(input.totalAmount - totalAmount) > ORDER_LIMITS.totalTolerance
    ) {
      return rejected(
        `The live catalogue prices changed the item subtotal to ${itemsSubtotal}. With the confirmed delivery fee of ${deliveryFee}, the new total is ${totalAmount}. Ask the customer to confirm this updated total before creating the order.`
      );
    }
    if (totalAmount > ORDER_LIMITS.maxTotal) {
      return rejected(
        `The order total came to ${totalAmount}, above the ${ORDER_LIMITS.maxTotal} limit.`
      );
    }

    // ── Write ────────────────────────────────────────────────────────────────
    const orderData = {
      chatbotId: chatbot.chatbotId,
      sessionId: session.sessionId,
      customerName: finalized.order.customerName,
      customerPhone: finalized.order.customerPhone,
      deliveryAddress: finalized.order.deliveryAddress,
      district: finalized.order.district || null,
      items: resolution.items,
      deliveryFee,
      totalAmount,
      paymentMethod: "COD",
      paymentStatus: "pending",
      status: "Processing",
    };

    let created: { id: string; orderId: string; createdAt: Date } | null = null;
    for (let attempt = 0; attempt < ORDER_ID_ATTEMPTS && !created; attempt += 1) {
      try {
        created = await db.order.create({
          data: { ...orderData, orderId: generateOrderId() },
          select: { id: true, orderId: true, createdAt: true },
        });
      } catch (error) {
        // `orderId` is unique but randomly generated, so a collision is possible
        // in principle (~1 in 4.3 billion). Retrying is cheaper than reasoning
        // about how rare that is, and keeps the customer from seeing a failure
        // over a display id.
        const isLastAttempt = attempt === ORDER_ID_ATTEMPTS - 1;
        if (!isUniqueViolation(error) || isLastAttempt) throw error;
      }
    }

    if (!created) {
      // Unreachable: the loop either assigns `created` or rethrows. Kept so the
      // response below never reads an id off a null.
      console.error("[INTERNAL_ORDERS] exhausted order-id attempts");
      return NextResponse.json({ error: "Could not allocate an order id" }, { status: 500 });
    }

    console.log("[INTERNAL_ORDERS] created", {
      orderId: created.orderId,
      chatbotId: chatbot.chatbotId,
      itemCount: resolution.items.length,
      totalAmount,
      priceCorrections: resolution.priceCorrections,
    });

    const integration = session.integrationId
      ? await db.integration.findUnique({
          where: { integrationId: session.integrationId },
          select: { config: true },
        })
      : null;
    const config = integration?.config;
    const configValues =
      typeof config === "object" && config !== null && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {};
    const merchantName =
      [configValues.pageName, configValues.accountName, configValues.instagramName, configValues.businessName]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim() || chatbot.name;

    // Messenger renders this structured payload as its native receipt card.
    // Product thumbnails reuse public catalogue images; no receipt artwork is
    // generated or uploaded.
    const catalogueById = new Map(resolutionCatalogue.map((product) => [product.productId, product]));
    const orderReceipt = {
      template_type: "receipt",
      recipient_name: finalized.order.customerName,
      merchant_name: merchantName,
      order_number: created.orderId,
      currency: "BDT",
      payment_method: "Cash on delivery",
      timestamp: String(Math.floor(created.createdAt.getTime() / 1000)),
      elements: resolution.items.map((item) => {
        const product = item.productId ? catalogueById.get(item.productId) : undefined;
        const imageUrl = [product?.imageUrl, ...(product?.imageUrls || [])].find(
          (url): url is string => typeof url === "string" && /^https:\/\//i.test(url)
        );
        return {
          title: item.name,
          quantity: item.qty,
          price: item.price,
          currency: "BDT",
          ...(imageUrl ? { image_url: imageUrl } : {}),
        };
      }),
      address: {
        street_1: finalized.order.deliveryAddress,
        city: finalized.order.district || "",
        country: "Bangladesh",
      },
      summary: {
        subtotal: itemsSubtotal,
        shipping_cost: deliveryFee,
        total_cost: totalAmount,
      },
    };

    return NextResponse.json({
      success: true,
      orderId: created.orderId,
      orderRecordId: created.id,
      itemsSubtotal,
      deliveryFee,
      totalAmount,
      itemCount: resolution.items.length,
      orderReceipt,
      // Told to the model so it can mention the corrected price instead of
      // repeating the number it had wrong.
      ...(resolution.priceCorrections > 0
        ? { priceCorrections: resolution.priceCorrections }
        : {}),
    });
  } catch (error) {
    console.error("[INTERNAL_ORDERS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
