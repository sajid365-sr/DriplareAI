import { describe, expect, it } from "vitest";

import { timingSafeEqualString } from "./timing-safe";

const SECRET = "a-long-random-shared-secret-value";

describe("timingSafeEqualString", () => {
  it("accepts an exact match", () => {
    expect(timingSafeEqualString(SECRET, SECRET)).toBe(true);
  });

  it("rejects a wrong value of the same length", () => {
    const wrong = `${SECRET.slice(0, -1)}X`;

    expect(wrong).toHaveLength(SECRET.length);
    expect(timingSafeEqualString(wrong, SECRET)).toBe(false);
  });

  it("rejects a value that only shares a prefix", () => {
    expect(timingSafeEqualString(SECRET.slice(0, 10), SECRET)).toBe(false);
  });

  it("rejects a longer value built from the secret", () => {
    expect(timingSafeEqualString(`${SECRET}extra`, SECRET)).toBe(false);
  });

  it.each([[null], [undefined], [""]])("rejects the provided value %p", (provided) => {
    expect(timingSafeEqualString(provided, SECRET)).toBe(false);
  });

  it.each([[null], [undefined], [""]])(
    "rejects every provided value when the expected secret is %p",
    (expected) => {
      expect(timingSafeEqualString(SECRET, expected)).toBe(false);
    }
  );

  it("does not authorise a request when the secret is unset on both sides", () => {
    // The dangerous case: `undefined === undefined` is true, so a naive
    // comparison would open the endpoint whenever the env var is missing.
    expect(timingSafeEqualString(undefined, undefined)).toBe(false);
    expect(timingSafeEqualString(null, null)).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(false);
  });

  it("compares by bytes, so a multi-byte value is not mistaken for an equal one", () => {
    // Both are 2 characters, but "আব" is 4 UTF-8 bytes and "ab" is 2. Comparing
    // by character count would call these the same length and then throw.
    expect(timingSafeEqualString("আব", "ab")).toBe(false);
  });
});
