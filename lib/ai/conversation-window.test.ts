import { describe, expect, it } from "vitest";

import {
  getConversationDateBounds,
  getConversationLimit,
  isDateOnly,
  isValidDateRange,
  isWithinConversationDateBounds,
  MAX_CONVERSATIONS_PER_SOURCE,
} from "./conversation-window";

describe("conversation history selection", () => {
  it("accepts valid calendar dates and rejects malformed dates", () => {
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2026/02/28")).toBe(false);
  });

  it("requires a complete ordered date range", () => {
    expect(isValidDateRange("2026-04-01", "2026-04-30")).toBe(true);
    expect(isValidDateRange("2026-04-30", "2026-04-01")).toBe(false);
    expect(isValidDateRange("2026-04-01", undefined)).toBe(false);
  });

  it("includes the full end date in date-range bounds", () => {
    const bounds = getConversationDateBounds("date_range", "2026-04-01", "2026-04-30");
    expect(isWithinConversationDateBounds("2026-04-01T00:00:00.000Z", bounds)).toBe(true);
    expect(isWithinConversationDateBounds("2026-04-30T23:59:59.999Z", bounds)).toBe(true);
    expect(isWithinConversationDateBounds("2026-05-01T00:00:00.000Z", bounds)).toBe(false);
  });

  it("caps all history modes and clamps recent counts", () => {
    expect(getConversationLimit("recent", 25)).toBe(25);
    expect(getConversationLimit("recent", 1000)).toBe(MAX_CONVERSATIONS_PER_SOURCE);
    expect(getConversationLimit("recent", 0)).toBe(1);
    expect(getConversationLimit("all_available", 25)).toBe(MAX_CONVERSATIONS_PER_SOURCE);
    expect(getConversationLimit("date_range", 25)).toBe(MAX_CONVERSATIONS_PER_SOURCE);
  });
});
