/** Delivery notification message templates per courier status (Feature #23). */

export type DeliveryStatus = "Dispatched" | "In Transit" | "Out for Delivery" | "Delivered";

export interface NotificationTemplate {
  en: string;
  bn: string;
}

/**
 * Returns a formatted notification message based on order status.
 * Supports both English and Bengali (bn).
 */
export function getDeliveryNotificationTemplate(
  status: DeliveryStatus,
  params: {
    trackingId: string;
    courierName: string;
    orderId: string;
    customerName: string;
  },
  lang: "en" | "bn" = "en"
): string {
  const { trackingId, courierName, orderId, customerName } = params;

  const templates: Record<DeliveryStatus, NotificationTemplate> = {
    Dispatched: {
      en: `📦 Hi ${customerName}!\n\nYour order #${orderId} has been handed over to ${courierName}.\n🔍 Tracking ID: ${trackingId}\n\nYou'll receive updates as your parcel moves. Thank you for shopping with us! 🙏`,
      bn: `📦 হ্যালো ${customerName}!\n\nআপনার অর্ডার #${orderId} ${courierName} courier-এ হস্তান্তর করা হয়েছে।\n🔍 Tracking ID: ${trackingId}\n\nআপনার পার্সেলের প্রতিটি update আমরা জানাব। সাথে থাকার জন্য ধন্যবাদ! 🙏`,
    },
    "In Transit": {
      en: `🚚 Update on your order #${orderId}!\n\nYour parcel is in transit with ${courierName}.\n🔍 Tracking ID: ${trackingId}\n\nExpected delivery: within 1-2 business days. Stay tuned!`,
      bn: `🚚 আপনার অর্ডার #${orderId} আপডেট!\n\nআপনার পার্সেল ${courierName}-এর সাথে পথে রয়েছে।\n🔍 Tracking ID: ${trackingId}\n\nপ্রত্যাশিত ডেলিভারি: ১-২ কার্যদিবসের মধ্যে। ধন্যবাদ!`,
    },
    "Out for Delivery": {
      en: `🚴 Great news, ${customerName}!\n\nYour order #${orderId} is OUT FOR DELIVERY today!\nPlease keep your phone reachable to receive the parcel.\n\nTracking: ${trackingId}`,
      bn: `🚴 সুখবর ${customerName}!\n\nআপনার অর্ডার #${orderId} আজ ডেলিভারির জন্য বের হয়েছে!\nঅনুগ্রহ করে পার্সেলটি গ্রহণের জন্য ফোন চালু রাখুন।\n\nTracking: ${trackingId}`,
    },
    Delivered: {
      en: `✅ Delivered! Thank you, ${customerName}!\n\nYour order #${orderId} has been successfully delivered! 🎉\n\nWe hope you love your purchase. Your feedback means the world to us! ⭐`,
      bn: `✅ ডেলিভারি সম্পন্ন! ধন্যবাদ ${customerName}!\n\nআপনার অর্ডার #${orderId} সফলভাবে পৌঁছে গেছে! 🎉\n\nআশা করি আপনি পণ্যটি পছন্দ করেছেন। আপনার মতামত আমাদের জন্য মূল্যবান! ⭐`,
    },
  };

  const template = templates[status];
  return template ? template[lang] : "";
}
