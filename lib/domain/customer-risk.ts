/** Customer delivery risk profiling logic (Feature #25). */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface RiskProfile {
  phone: string;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  cancelledOrders: number;
  returnRate: number;
  cancelRate: number;
  riskLevel: RiskLevel;
  riskScore: number;
}

export interface OrderSummary {
  status: string;
}

/**
 * Calculates customer delivery risk profile based on historical order outcomes.
 *
 * Risk thresholds:
 *   LOW:    returnRate < 10% && cancelRate < 15%
 *   MEDIUM: returnRate 10–25% || cancelRate 15–30%
 *   HIGH:   returnRate > 25% || cancelRate > 30%
 */
export function calculateRiskProfile(
  phone: string,
  orders: OrderSummary[]
): RiskProfile {
  const totalOrders = orders.length;

  if (totalOrders === 0) {
    return {
      phone,
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      cancelledOrders: 0,
      returnRate: 0,
      cancelRate: 0,
      riskLevel: "LOW",
      riskScore: 0,
    };
  }

  const deliveredOrders = orders.filter((o) => o.status === "Delivered").length;
  const returnedOrders = orders.filter(
    (o) => o.status === "Returned" || o.status === "Damage"
  ).length;
  const cancelledOrders = orders.filter((o) => o.status === "Cancelled").length;

  const returnRate = (returnedOrders / totalOrders) * 100;
  const cancelRate = (cancelledOrders / totalOrders) * 100;

  const riskScore = Math.min(100, Math.round(returnRate * 0.6 + cancelRate * 0.4));

  let riskLevel: RiskLevel;
  if (returnRate > 25 || cancelRate > 30) {
    riskLevel = "HIGH";
  } else if (returnRate >= 10 || cancelRate >= 15) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  return {
    phone,
    totalOrders,
    deliveredOrders,
    returnedOrders,
    cancelledOrders,
    returnRate: Math.round(returnRate * 10) / 10,
    cancelRate: Math.round(cancelRate * 10) / 10,
    riskLevel,
    riskScore,
  };
}
