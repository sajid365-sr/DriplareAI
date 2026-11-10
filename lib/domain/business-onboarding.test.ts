import { describe, expect, it } from "vitest";
import {
  businessOnboardingDraftSchema,
  businessOnboardingSchema,
} from "@/lib/domain/business-onboarding";

const validOnboarding = {
  requestId: "9f1f4726-c512-42b0-9d0b-a52792c06731",
  name: "Driplare Store",
  category: "ecommerce",
  customBusinessTitle: "Orders",
  logoUrl: null,
};

describe("business onboarding validation", () => {
  it("accepts a complete business setup", () => {
    expect(businessOnboardingSchema.safeParse(validOnboarding).success).toBe(true);
  });

  it("requires a business name and category before authentication", () => {
    expect(
      businessOnboardingSchema.safeParse({
        ...validOnboarding,
        name: " ",
      }).success
    ).toBe(false);
    expect(
      businessOnboardingSchema.safeParse({
        ...validOnboarding,
        category: "",
      }).success
    ).toBe(false);
  });

  it("rejects malformed or oversized onboarding data", () => {
    expect(
      businessOnboardingSchema.safeParse({
        ...validOnboarding,
        requestId: "not-a-uuid",
      }).success
    ).toBe(false);
    expect(
      businessOnboardingSchema.safeParse({
        ...validOnboarding,
        name: "x".repeat(101),
      }).success
    ).toBe(false);
    expect(
      businessOnboardingSchema.safeParse({
        ...validOnboarding,
        logoUrl: `data:image/jpeg;base64,${"x".repeat(200_000)}`,
      }).success
    ).toBe(false);
  });

  it("allows incomplete but well-formed drafts while the user is stepping through", () => {
    expect(
      businessOnboardingDraftSchema.safeParse({
        requestId: "",
        name: "",
        category: "",
        customBusinessTitle: "",
        logoUrl: null,
      }).success
    ).toBe(true);
  });
});
