import "server-only";

import { db } from "@/lib/core/db";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";
import {
  getDeliveryNotificationTemplate,
  type DeliveryStatus,
} from "@/lib/templates/delivery-notification-templates";

export interface SendDeliveryNotificationInput {
  orderId: string;
  status: DeliveryStatus;
  botIds: string[];
  sessionId: string;
  customerName: string;
  trackingId: string;
  courierName: string;
  orderPublicId: string;
}

/**
 * Sends a status-change notification to the customer's chat session (Feature #23).
 * Records `lastNotificationStatus` to prevent duplicate notifications.
 */
export async function sendDeliveryNotification(
  input: SendDeliveryNotificationInput
): Promise<void> {
  const message = getDeliveryNotificationTemplate(
    input.status,
    {
      trackingId: input.trackingId,
      courierName: input.courierName,
      orderId: input.orderPublicId,
      customerName: input.customerName,
    },
    "en"
  );

  if (!message) return;

  try {
    await deliverInboxMessage({
      botIds: input.botIds,
      sessionId: input.sessionId,
      text: message,
    });

    await db.order.update({
      where: { id: input.orderId },
      data: { lastNotificationStatus: input.status },
    });
  } catch (err) {
    console.error(`[DELIVERY_NOTIFICATION] Failed for order ${input.orderId}:`, err);
  }
}

/**
 * Sends a post-delivery review request message (Feature #24).
 * Records `reviewRequestSentAt` timestamp to prevent duplicate sending.
 */
export async function sendReviewRequest(input: {
  orderId: string;
  botIds: string[];
  sessionId: string;
  customerName: string;
  orderPublicId: string;
}): Promise<void> {
  const message = [
    `⭐ Hi ${input.customerName}!`,
    ``,
    `We hope you are enjoying your order #${input.orderPublicId}! 🎉`,
    ``,
    `Could you take a moment to rate your experience? Your feedback helps us serve you better.`,
    ``,
    `Rate our service: ⭐⭐⭐⭐⭐`,
    ``,
    `Thank you for shopping with us! 🙏`,
  ].join("\n");

  try {
    await deliverInboxMessage({
      botIds: input.botIds,
      sessionId: input.sessionId,
      text: message,
    });

    await db.order.update({
      where: { id: input.orderId },
      data: { reviewRequestSentAt: new Date() },
    });
  } catch (err) {
    console.error(`[REVIEW_REQUEST] Failed for order ${input.orderId}:`, err);
  }
}

