import "server-only";

import { db } from "@/lib/core/db";

export type CourierName = "Steadfast" | "Pathao" | "RedX";

export interface CourierBookingInput {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  totalAmount: number;
  note?: string;
}

export interface CourierBookingResult {
  success: boolean;
  trackingId?: string;
  courierOrderId?: string;
  error?: string;
}

/** Book a parcel via Steadfast API */
async function bookSteadfast(
  apiKey: string,
  secretKey: string,
  input: CourierBookingInput
): Promise<CourierBookingResult> {
  try {
    const payload = {
      invoice: input.orderId,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      cod_amount: input.codAmount,
      note: input.note ?? "",
    };

    const res = await fetch("https://portal.packzy.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      status: number;
      consignment?: { tracking_code?: string; id?: string | number };
      message?: string;
    };

    if (res.ok && data.status === 200 && data.consignment?.tracking_code) {
      return {
        success: true,
        trackingId: data.consignment.tracking_code,
        courierOrderId: String(data.consignment.id ?? ""),
      };
    }

    return { success: false, error: data.message ?? "Steadfast booking failed" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Book a parcel via Pathao API */
async function bookPathao(
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
  storeId: string,
  input: CourierBookingInput
): Promise<CourierBookingResult> {
  try {
    const tokenRes = await fetch("https://hermes.pathao.com/api/v1/issue-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
        grant_type: "password",
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; message?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      return { success: false, error: `Pathao auth failed: ${tokenData.message ?? "unknown"}` };
    }

    const orderRes = await fetch("https://hermes.pathao.com/api/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        store_id: storeId,
        merchant_order_id: input.orderId,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
        recipient_city: 1,
        recipient_zone: 1,
        delivery_type: 48,
        item_type: 2,
        special_instruction: input.note ?? "",
        item_quantity: 1,
        item_weight: 0.5,
        amount_to_collect: input.codAmount,
        item_description: "Order items",
      }),
    });

    const orderData = (await orderRes.json()) as {
      code: number;
      data?: { consignment_id?: string; order_status?: string };
      message?: { details?: string[] };
    };

    if (orderRes.ok && orderData.code === 200 && orderData.data?.consignment_id) {
      return {
        success: true,
        trackingId: orderData.data.consignment_id,
        courierOrderId: orderData.data.consignment_id,
      };
    }

    const errMsg = Array.isArray(orderData.message?.details)
      ? orderData.message.details.join(", ")
      : "Pathao booking failed";
    return { success: false, error: errMsg };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Book a parcel via RedX API */
async function bookRedX(
  apiToken: string,
  input: CourierBookingInput
): Promise<CourierBookingResult> {
  try {
    const res = await fetch("https://openapi.redx.com.bd/v1.0.0-beta/parcel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        name: input.recipientName,
        phone: input.recipientPhone,
        address: input.recipientAddress,
        merchant_invoice_id: input.orderId,
        cash_collection_amount: input.codAmount,
        delivery_charge: 60,
        instruction: input.note ?? "",
        value: input.totalAmount,
        weight: 0.5,
      }),
    });

    const data = (await res.json()) as { tracking_id?: string; error?: string; message?: string };

    if (res.ok && data.tracking_id) {
      return { success: true, trackingId: data.tracking_id };
    }

    return { success: false, error: data.error ?? data.message ?? "RedX booking failed" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Unified parcel booking service.
 * Looks up merchant's courier config and dispatches to the specified courier provider.
 */
export async function dispatchParcel(
  userId: string,
  orderDbId: string,
  courier: CourierName
): Promise<CourierBookingResult> {
  const order = await db.order.findUnique({ where: { id: orderDbId } });
  if (!order) return { success: false, error: "Order not found" };

  const config = await db.courierConfig.findUnique({ where: { userId } });
  if (!config) return { success: false, error: "Courier credentials not configured" };

  const input: CourierBookingInput = {
    orderId: order.orderId,
    recipientName: order.customerName,
    recipientPhone: order.customerPhone ?? "",
    recipientAddress: order.deliveryAddress ?? "",
    codAmount: order.totalAmount,
    totalAmount: order.totalAmount,
    note: order.internalNotes ?? "",
  };

  let result: CourierBookingResult;

  switch (courier) {
    case "Steadfast":
      if (!config.steadfastApiKey || !config.steadfastSecretKey) {
        return { success: false, error: "Steadfast credentials missing" };
      }
      result = await bookSteadfast(config.steadfastApiKey, config.steadfastSecretKey, input);
      break;

    case "Pathao":
      if (
        !config.pathaoClientId ||
        !config.pathaoClientSecret ||
        !config.pathaoUsername ||
        !config.pathaoPassword ||
        !config.pathaoStoreId
      ) {
        return { success: false, error: "Pathao credentials missing" };
      }
      result = await bookPathao(
        config.pathaoClientId,
        config.pathaoClientSecret,
        config.pathaoUsername,
        config.pathaoPassword,
        config.pathaoStoreId,
        input
      );
      break;

    case "RedX":
      if (!config.redxApiToken) {
        return { success: false, error: "RedX credentials missing" };
      }
      result = await bookRedX(config.redxApiToken, input);
      break;

    default:
      return { success: false, error: `Unsupported courier: ${courier}` };
  }

  // If successful, save tracking ID and set order status to Dispatched
  if (result.success && result.trackingId) {
    await db.order.update({
      where: { id: order.id },
      data: {
        courierName: courier,
        courierTrackingId: result.trackingId,
        status: "Dispatched",
        updatedAt: new Date(),
      },
    });
  }

  return result;
}

