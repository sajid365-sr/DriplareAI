import { describe, expect, it } from "vitest";

import {
  ORDER_LIMITS,
  createOrderRequestSchema,
  finalizeOrder,
  normalizeBdPhone,
  normalizeOrderPayload,
  resolveItemsAgainstCatalogue,
  sumItems,
} from "./order-schema";

/** A payload every rule accepts. Each test spoils exactly one thing. */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    chatbotId: "bot_123",
    sessionId: "sess_abc",
    customerName: "Rahim Uddin",
    customerPhone: "01712345678",
    deliveryAddress: "House 12, Road 5, Mirpur, Dhaka",
    items: [{ name: "Cotton Panjabi", qty: 1, price: 1250 }],
    ...overrides,
  };
}

/**
 * Runs the route's two validation stages in order and reports which one stopped
 * the payload, so a test can assert *where* a rule lives and not just that
 * something failed. `fields` is always present — empty on success — so a test
 * never has to narrow before listing what failed.
 */
function validate(raw: unknown) {
  const parsed = createOrderRequestSchema.safeParse(normalizeOrderPayload(raw));
  if (!parsed.success) {
    return {
      ok: false as const,
      stage: "schema" as const,
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    };
  }

  const finalized = finalizeOrder(parsed.data);
  if (!finalized.ok) {
    return {
      ok: false as const,
      stage: "rules" as const,
      fields: finalized.issues.map((issue) => issue.field),
    };
  }

  return { ok: true as const, stage: "none" as const, fields: [] as string[], order: finalized.order };
}

// ─── normalizeBdPhone ─────────────────────────────────────────────────────────

describe("normalizeBdPhone", () => {
  const CANONICAL = "01712345678";

  it("accepts the local 11-digit form unchanged", () => {
    expect(normalizeBdPhone(CANONICAL)).toBe(CANONICAL);
  });

  it.each([
    ["dashes", "01712-345678"],
    ["spaces", "017 1234 5678"],
    ["plus country code", "+8801712345678"],
    ["country code without plus", "8801712345678"],
    ["trunk 0 omitted", "1712345678"],
    ["parentheses", "(017) 12345678"],
    ["Bengali numerals", "০১৭১২৩৪৫৬৭৮"],
  ])("normalises the %s spelling", (_label, spelling) => {
    expect(normalizeBdPhone(spelling)).toBe(CANONICAL);
  });

  it.each([
    ["operator code 012 does not exist", "01212345678"],
    ["one digit short", "0171234567"],
    ["one digit long", "017123456789"],
    ["landline", "029123456"],
    ["letters", "not-a-number"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(normalizeBdPhone(value)).toBeNull();
  });

  it.each([[null], [undefined], [12345678], [{}]])(
    "rejects the non-string value %p without throwing",
    (value) => {
      expect(normalizeBdPhone(value)).toBeNull();
    }
  );
});

// ─── normalizeOrderPayload ────────────────────────────────────────────────────

describe("normalizeOrderPayload", () => {
  it("parses an items array that arrived JSON-encoded", () => {
    const payload = validPayload({ items: JSON.stringify([{ name: "Panjabi", qty: 1, price: 1250 }]) });
    const result = validate(payload);

    expect(result.ok).toBe(true);
  });

  it("leaves malformed items JSON as the original string so the type error is reported", () => {
    const result = validate(validPayload({ items: "[{ name: 'Panjabi'" }));

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("schema");
    expect(result.fields).toContain("items");
  });

  it("coerces quoted and comma-grouped numbers", () => {
    const result = validate(
      validPayload({ totalAmount: "1,250", items: [{ name: "Panjabi", qty: "1", price: "1250" }] })
    );

    expect(result.ok).toBe(true);
  });

  it("does not let an empty price collapse into a free item", () => {
    const result = validate(validPayload({ items: [{ name: "Panjabi", qty: 1, price: "" }] }));

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("schema");
  });

  it("treats a blank productId as absent rather than as a lookup key", () => {
    const result = validate(
      validPayload({ items: [{ productId: "", name: "Panjabi", qty: 1, price: 1250 }] })
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.items[0].productId).toBeUndefined();
  });

  it.each([[null], ["a string"], [42], [[1, 2, 3]]])(
    "returns the non-object payload %p untouched",
    (value) => {
      expect(normalizeOrderPayload(value)).toBe(value);
    }
  );
});

// ─── schema rules ─────────────────────────────────────────────────────────────

describe("createOrderRequestSchema", () => {
  it("accepts a complete, valid order", () => {
    expect(validate(validPayload()).ok).toBe(true);
  });

  it.each([
    ["a one-character name", { customerName: "R" }],
    ["an address that is not deliverable", { deliveryAddress: "Dhaka" }],
    ["a missing chatbotId", { chatbotId: "" }],
    ["an empty item list", { items: [] }],
    ["more items than the ceiling", {
      items: Array.from({ length: ORDER_LIMITS.maxItems + 1 }, () => ({
        name: "Panjabi",
        qty: 1,
        price: 100,
      })),
    }],
  ])("rejects %s", (_label, overrides) => {
    const result = validate(validPayload(overrides));

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("schema");
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    [`above the ${ORDER_LIMITS.maxItemQty} ceiling`, ORDER_LIMITS.maxItemQty + 1],
    ["fractional", 1.5],
  ])("rejects a quantity that is %s", (_label, qty) => {
    const result = validate(validPayload({ items: [{ name: "Panjabi", qty, price: 100 }] }));

    expect(result.ok).toBe(false);
    expect(result.fields.some((field) => field.includes("qty"))).toBe(true);
  });

  it("rejects a negative price", () => {
    const result = validate(validPayload({ items: [{ name: "Panjabi", qty: 1, price: -5 }] }));

    expect(result.ok).toBe(false);
  });

  it("strips unknown keys so a caller cannot set the row's own status", () => {
    const parsed = createOrderRequestSchema.safeParse(
      normalizeOrderPayload(validPayload({ status: "paid", paymentStatus: "paid", totalAmount: 0 }))
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("status" in parsed.data).toBe(false);
      expect("paymentStatus" in parsed.data).toBe(false);
    }
  });
});

// ─── finalizeOrder ────────────────────────────────────────────────────────────

describe("finalizeOrder", () => {
  it("derives the total from the item lines", () => {
    const result = validate(
      validPayload({
        items: [
          { name: "Panjabi", qty: 2, price: 1250 },
          { name: "Pajama", qty: 1, price: 450 },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.totalAmount).toBe(2950);
  });

  it("normalises the phone onto the order", () => {
    const result = validate(validPayload({ customerPhone: "+880 1712-345678" }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.customerPhone).toBe("01712345678");
  });

  it("rejects a phone that is not a Bangladeshi mobile number", () => {
    const result = validate(validPayload({ customerPhone: "01212345678" }));

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("rules");
    expect(result.fields).toContain("customerPhone");
  });

  it("rejects a total that disagrees with the model's own item lines", () => {
    const result = validate(
      validPayload({ totalAmount: 999, items: [{ name: "Panjabi", qty: 1, price: 1250 }] })
    );

    expect(result.ok).toBe(false);
    expect(result.fields).toContain("totalAmount");
  });

  it("tolerates a rounding difference of one taka", () => {
    const result = validate(
      validPayload({ totalAmount: 1249, items: [{ name: "Panjabi", qty: 1, price: 1250 }] })
    );

    expect(result.ok).toBe(true);
  });

  it("rejects an order whose lines add up to nothing", () => {
    const result = validate(validPayload({ items: [{ name: "Free sample", qty: 1, price: 0 }] }));

    expect(result.ok).toBe(false);
    expect(result.fields).toContain("items");
  });

  it("reports every broken field at once so the model needs one retry, not three", () => {
    const result = validate(validPayload({ customerPhone: "nope", totalAmount: 5 }));

    expect(result.ok).toBe(false);
    expect(result.fields).toContain("customerPhone");
    expect(result.fields).toContain("totalAmount");
  });

  it("defaults a missing district to an empty string", () => {
    const result = validate(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.district).toBe("");
  });
});

// ─── resolveItemsAgainstCatalogue ─────────────────────────────────────────────

describe("resolveItemsAgainstCatalogue", () => {
  const catalogue = [
    { productId: "p1", name: "Cotton Panjabi", price: 1250, isActive: true },
    { productId: "p2", name: "Retired Kurta", price: 900, isActive: false },
    { productId: "p3", name: "Price on request", price: null, isActive: true },
  ];

  it("replaces a model-supplied price with the live catalogue price", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ productId: "p1", name: "Panjabi (model wording)", qty: 2, price: 999 }],
      catalogue
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].price).toBe(1250);
      expect(result.items[0].name).toBe("Cotton Panjabi");
      expect(result.priceCorrections).toBe(1);
    }
  });

  it("counts no correction when the model already had the right price", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ productId: "p1", name: "Cotton Panjabi", qty: 1, price: 1250 }],
      catalogue
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.priceCorrections).toBe(0);
  });

  it("fails when the productId is not in this chatbot's catalogue", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ productId: "someone-elses-product", name: "Panjabi", qty: 1, price: 1250 }],
      catalogue
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("someone-elses-product");
  });

  it("fails when the product exists but is no longer active", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ productId: "p2", name: "Retired Kurta", qty: 1, price: 900 }],
      catalogue
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Retired Kurta");
  });

  it("keeps the line's own price when the merchant never set one", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ productId: "p3", name: "Price on request", qty: 1, price: 500 }],
      catalogue
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].price).toBe(500);
      expect(result.priceCorrections).toBe(0);
    }
  });

  it("passes a custom item through untouched", () => {
    const result = resolveItemsAgainstCatalogue(
      [{ name: "Hand-made gift box", qty: 1, price: 300 }],
      catalogue
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items[0]).toEqual({ name: "Hand-made gift box", qty: 1, price: 300 });
  });

  it("rejects a mixed order rather than silently dropping the bad line", () => {
    const result = resolveItemsAgainstCatalogue(
      [
        { productId: "p1", name: "Panjabi", qty: 1, price: 1250 },
        { productId: "ghost", name: "Ghost", qty: 1, price: 10 },
      ],
      catalogue
    );

    expect(result.ok).toBe(false);
  });
});

// ─── sumItems ─────────────────────────────────────────────────────────────────

describe("sumItems", () => {
  it("keeps the total at two decimals", () => {
    expect(sumItems([{ name: "a", qty: 1, price: 0.1 }, { name: "b", qty: 1, price: 0.2 }])).toBe(0.3);
  });

  it("multiplies quantity by price", () => {
    expect(sumItems([{ name: "a", qty: 3, price: 19.99 }])).toBe(59.97);
  });

  it("is zero for an empty list", () => {
    expect(sumItems([])).toBe(0);
  });
});
