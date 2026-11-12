import { describe, expect, it } from "vitest";
import {
  getWorkspaceBusinessProfileFields,
  WorkspaceBusinessProfileCustomFieldsSchema,
} from "./workspace-business-profile";

describe("workspace business profile fields", () => {
  it("provides category-specific facts and leaves custom businesses flexible", () => {
    expect(getWorkspaceBusinessProfileFields("travel").map((field) => field.key)).toEqual([
      "travelServices",
      "popularDestinations",
    ]);
    expect(getWorkspaceBusinessProfileFields("healthcare").map((field) => field.key)).toEqual([
      "specialties",
      "appointmentTypes",
    ]);
    expect(getWorkspaceBusinessProfileFields("custom")).toEqual([]);
    expect(getWorkspaceBusinessProfileFields(undefined)).toEqual([]);
  });

  it("validates custom field values by their selected type", () => {
    expect(WorkspaceBusinessProfileCustomFieldsSchema.safeParse([
      { id: "booking-window", label: "Booking window", type: "number", value: "7" },
      { id: "online-booking", label: "Online booking", type: "boolean", value: "true" },
      { id: "booking-page", label: "Booking page", type: "url", value: "https://example.com/book" },
    ]).success).toBe(true);

    expect(WorkspaceBusinessProfileCustomFieldsSchema.safeParse([
      { id: "booking-window", label: "Booking window", type: "number", value: "next week" },
    ]).success).toBe(false);
    expect(WorkspaceBusinessProfileCustomFieldsSchema.safeParse([
      { id: "booking-page", label: "Booking page", type: "url", value: "not a URL" },
    ]).success).toBe(false);
  });

  it("rejects duplicate names and more than twenty custom fields", () => {
    expect(WorkspaceBusinessProfileCustomFieldsSchema.safeParse([
      { id: "first", label: "Phone", type: "text", value: "123" },
      { id: "second", label: "phone", type: "text", value: "456" },
    ]).success).toBe(false);

    const tooManyFields = Array.from({ length: 21 }, (_, index) => ({
      id: `field-${index}`,
      label: `Field ${index}`,
      type: "text" as const,
      value: "",
    }));
    expect(WorkspaceBusinessProfileCustomFieldsSchema.safeParse(tooManyFields).success).toBe(false);
  });
});
