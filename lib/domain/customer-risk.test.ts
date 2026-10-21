import { describe, it, expect } from "vitest";
import { calculateRiskProfile } from "./customer-risk";

describe("calculateRiskProfile", () => {
  it("handles zero orders gracefully with LOW risk", () => {
    const profile = calculateRiskProfile("01700000000", []);
    expect(profile.riskLevel).toBe("LOW");
    expect(profile.totalOrders).toBe(0);
    expect(profile.riskScore).toBe(0);
  });

  it("classifies customer with only delivered orders as LOW risk", () => {
    const orders = [
      { status: "Delivered" },
      { status: "Delivered" },
      { status: "Delivered" },
    ];
    const profile = calculateRiskProfile("01711111111", orders);
    expect(profile.riskLevel).toBe("LOW");
    expect(profile.returnRate).toBe(0);
    expect(profile.cancelRate).toBe(0);
    expect(profile.riskScore).toBe(0);
  });

  it("classifies customer with 1 return out of 5 orders as MEDIUM risk (20% return rate)", () => {
    const orders = [
      { status: "Delivered" },
      { status: "Delivered" },
      { status: "Delivered" },
      { status: "Delivered" },
      { status: "Returned" },
    ];
    const profile = calculateRiskProfile("01722222222", orders);
    expect(profile.returnRate).toBe(20);
    expect(profile.riskLevel).toBe("MEDIUM");
  });

  it("classifies customer with high cancellation/return rate as HIGH risk", () => {
    const orders = [
      { status: "Delivered" },
      { status: "Returned" },
      { status: "Cancelled" },
      { status: "Cancelled" },
    ];
    const profile = calculateRiskProfile("01733333333", orders);
    expect(profile.cancelRate).toBe(50);
    expect(profile.returnRate).toBe(25);
    expect(profile.riskLevel).toBe("HIGH");
  });
});

