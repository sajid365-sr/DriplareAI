import { describe, expect, it } from "vitest";
import { generateRawPromptFromWizard } from "./wizard-schema";

describe("generateRawPromptFromWizard", () => {
  it("keeps legacy business answers out of new Agent prompts", () => {
    const prompt = generateRawPromptFromWizard("ecommerce", {
      storeName: "Legacy Store Name",
      businessNiche: "Legacy niche",
      insideCityDelivery: "Legacy delivery fee",
      returnPolicy: "Legacy return policy",
      agentRole: "Sales & Order Assistant",
      botTone: "Professional",
    });

    expect(prompt).toContain("Sales & Order Assistant");
    expect(prompt).toContain("Professional");
    expect(prompt).not.toContain("Legacy Store Name");
    expect(prompt).not.toContain("Legacy niche");
    expect(prompt).not.toContain("Legacy delivery fee");
    expect(prompt).not.toContain("Legacy return policy");
    expect(prompt).not.toContain("Business Rules & Policies");
  });

  it("does not require or include business identity answers", () => {
    const prompt = generateRawPromptFromWizard("travel", {
      agencyName: "Legacy Travel Agency",
      popularDestinations: "Legacy destination",
      advanceBookingDays: "30 days",
      botTone: "Friendly",
    });

    expect(prompt).toContain("Friendly");
    expect(prompt).not.toContain("Legacy Travel Agency");
    expect(prompt).not.toContain("Legacy destination");
    expect(prompt).not.toContain("30 days");
  });
});
