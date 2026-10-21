import "server-only";

export interface PollResult {
  status: string | null;
  paymentStatus: string | null;
  raw?: unknown;
}

/** Map Steadfast delivery_status strings to internal order status */
function mapSteadfastStatus(sfStatus: string): { status: string; paymentStatus?: string } {
  switch (sfStatus) {
    case "delivered":
    case "partial_delivered":
      return { status: "Delivered", paymentStatus: "paid" };
    case "cancelled":
    case "cancelled_approval_pending":
      return { status: "Returned" };
    case "hold":
    case "delivered_approval_pending":
    case "partial_delivered_approval_pending":
      return { status: "In Transit" };
    case "out_for_delivery":
      return { status: "Out for Delivery" };
    case "pending":
    case "in_review":
    default:
      return { status: "Dispatched" };
  }
}

/** Poll Steadfast tracking API for real-time delivery status */
export async function pollSteadfast(
  apiKey: string,
  secretKey: string,
  trackingCode: string
): Promise<PollResult> {
  try {
    const res = await fetch(
      `https://portal.packzy.com/api/v1/status_by_trackingcode/${trackingCode}`,
      {
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
        },
        next: { revalidate: 0 },
      }
    );

    const text = await res.text();
    let data: { status?: number; delivery_status?: string } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      // Non-json response
    }

    if (res.ok && data.status === 200 && data.delivery_status) {
      const mapped = mapSteadfastStatus(data.delivery_status);
      return { status: mapped.status, paymentStatus: mapped.paymentStatus ?? null, raw: data };
    }

    return { status: null, paymentStatus: null, raw: data };
  } catch (err) {
    console.error(`[POLL_STEADFAST] trackingCode=${trackingCode}`, err);
    return { status: null, paymentStatus: null };
  }
}
