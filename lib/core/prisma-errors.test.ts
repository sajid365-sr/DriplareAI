import { describe, expect, it } from "vitest";

import { isRecordNotFound, isUniqueViolation } from "./prisma-errors";

describe("prisma error helpers", () => {
  it("detects a unique-constraint violation", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
  });

  it("detects a missing record", () => {
    expect(isRecordNotFound({ code: "P2025" })).toBe(true);
  });

  it("distinguishes the two codes", () => {
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isRecordNotFound({ code: "P2002" })).toBe(false);
  });

  it.each([[null], [undefined], ["P2002"], [42], [{}], [{ code: 2002 }]])(
    "rejects the non-matching value %p",
    (value) => {
      expect(isUniqueViolation(value)).toBe(false);
    }
  );
});
