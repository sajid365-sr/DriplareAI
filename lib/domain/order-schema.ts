import { z } from "zod";

/**
 * Order validation — the single place an order is checked before it is written.
 *
 * The AI Agent's `Create Order` tool is driven by a language model, so every
 * field it sends is a *claim*, not a fact: a misheard phone number, an address
 * the customer never finished giving, or a quantity the model invented. This
 * module is the gate those claims pass through. Nothing here touches the
 * database, so the whole rule set is unit-testable without a running Postgres.
 *
 * Two-layer design:
 *   1. `normalizeOrderPayload` — shape repair (JSON-encoded arrays, quoted
 *      numbers) so a formatting quirk does not read as a validation failure.
 *   2. `createOrderRequestSchema` + `finalizeOrder` — the actual rules.
 */

// ─── Limits ───────────────────────────────────────────────────────────────────

export const ORDER_LIMITS = {
  minNameLength: 2,
  maxNameLength: 100,
  minAddressLength: 10,
  maxAddressLength: 500,
  maxDistrictLength: 60,
  maxItemNameLength: 120,
  maxItems: 20,
  maxItemQty: 100,
  /** Per-unit ceiling. A COD parcel worth more than this is a misread price. */
  maxItemPrice: 1_000_000,
  /** Whole-order ceiling, in BDT. */
  maxTotal: 10_000_000,
  /** Totals within this many taka are treated as the same number (rounding). */
  totalTolerance: 1,
} as const;

// ─── Shape repair ─────────────────────────────────────────────────────────────

/**
 * Turns anything numeric-looking into a real number, and leaves everything else
 * untouched so Zod can report the type error.
 *
 * `""` is deliberately *not* coerced: `Number("")` is `0`, and a blank price
 * silently becoming a free item is exactly the kind of quiet wrong answer this
 * module exists to prevent.
 */
function coerceNumber(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "") return value;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : value;
}

/**
 * Repairs the payload's *shape* before validation, without making any judgement
 * about whether the values are acceptable.
 *
 * An AI tool parameter can only be a string, so `$fromAI('items_json', …)`
 * arrives as JSON text rather than an array. A real array is accepted too, so a
 * caller posting proper JSON is not rejected for choosing the nicer shape.
 * Unknown keys are left in place — `z.object` strips them, which is what keeps a
 * body from setting `status` or `paymentStatus` on the row it creates.
 */
export function normalizeOrderPayload(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;

  const payload: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  if (typeof payload.items === "string") {
    try {
      payload.items = JSON.parse(payload.items);
    } catch {
      // Left as the original string: Zod then reports `items` as the wrong type,
      // which reads better in the feed-back-to-the-model message than "invalid JSON".
    }
  }

  if (Array.isArray(payload.items)) {
    payload.items = payload.items.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return item;

      const line: Record<string, unknown> = { ...(item as Record<string, unknown>) };
      line.qty = coerceNumber(line.qty);
      line.price = coerceNumber(line.price);

      // `null` / `""` mean "no catalogue link", not "the link is empty". Deleting
      // the key lets the optional field stay undefined; a non-string value is
      // left alone so Zod can reject it loudly instead of us dropping it.
      if (line.productId === null || line.productId === undefined || line.productId === "") {
        delete line.productId;
      }

      return line;
    });
  }

  payload.totalAmount = coerceNumber(payload.totalAmount);

  return payload;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * One line of the order.
 *
 * `productId` is the only trustworthy key: when present, the live catalogue
 * price overrides `price` (see `resolveItemsAgainstCatalogue`). When absent, the
 * line is a custom or unlisted item and `price` is the model's own number.
 */
export const orderItemSchema = z.object({
  productId: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(ORDER_LIMITS.maxItemNameLength),
  qty: z.number().int().min(1).max(ORDER_LIMITS.maxItemQty),
  price: z.number().min(0).max(ORDER_LIMITS.maxItemPrice),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

export const createOrderRequestSchema = z.object({
  chatbotId: z.string().trim().min(1).max(64),
  sessionId: z.string().trim().min(1).max(128),
  customerName: z
    .string()
    .trim()
    .min(ORDER_LIMITS.minNameLength)
    .max(ORDER_LIMITS.maxNameLength),
  // Kept as a loose string here and narrowed by `normalizeBdPhone` so the
  // rejection message can say what a Bangladeshi number looks like.
  customerPhone: z.string().trim().min(1).max(30),
  deliveryAddress: z
    .string()
    .trim()
    .min(ORDER_LIMITS.minAddressLength)
    .max(ORDER_LIMITS.maxAddressLength),
  district: z.string().trim().max(ORDER_LIMITS.maxDistrictLength).optional(),
  items: z.array(orderItemSchema).min(1).max(ORDER_LIMITS.maxItems),
  totalAmount: z.number().min(0).max(ORDER_LIMITS.maxTotal).optional(),
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

// ─── Cross-field rules ────────────────────────────────────────────────────────

export type OrderValidationIssue = { field: string; message: string };

export type FinalizedOrder = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  district: string;
  items: OrderItem[];
  /** Always derived from the item lines — never the model's own arithmetic. */
  totalAmount: number;
};

/** Money lives in a `Float` column, so keep it at two decimals. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The order total, computed from the lines. Exported because the route must
 * recompute it after catalogue prices replace the model's. */
export function sumItems(items: readonly OrderItem[]): number {
  return round2(items.reduce((total, item) => total + item.qty * item.price, 0));
}

const BD_MOBILE_LOCAL = /^01[3-9]\d{8}$/;

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/**
 * Reduces every spelling of a Bangladeshi mobile number to the local
 * 11-digit form (`01XXXXXXXXX`), or `null` if it is not one.
 *
 * Models write the same number as `01712-345678`, `+8801712345678` or
 * `8801712345678` interchangeably, and a Bengali-speaking customer often types
 * it in Bengali numerals (`০১৭…`). Formatting is not a reason to reject a real
 * customer, so the script, punctuation and country code are all normalised away
 * first and only the final digit pattern is judged.
 */
export function normalizeBdPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  // Transliterate before stripping: every Bengali digit is a single BMP code
  // point, so a per-character lookup is exact and needs no `\d` locale flags.
  let digits = raw.replace(/[০-৯]/g, (digit) => String(BENGALI_DIGITS.indexOf(digit)));

  digits = digits.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);

  // `88` is Bangladesh's country code; `1` + 9 digits is the number without the
  // trunk `0`. Both are restored to the local form before the pattern test.
  if (digits.startsWith("880")) digits = digits.slice(3);
  else if (digits.startsWith("88")) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;

  return BD_MOBILE_LOCAL.test(digits) ? digits : null;
}

export type FinalizeResult =
  | { ok: true; order: FinalizedOrder }
  | { ok: false; issues: OrderValidationIssue[] };

/**
 * Applies the rules a per-field schema cannot express: phone normalisation,
 * order-size ceilings, and a cross-check of the model's stated total against the
 * lines it actually sent.
 *
 * Every issue is collected before returning, so the model is told everything
 * that is wrong in one round trip instead of discovering it one field per retry.
 */
export function finalizeOrder(input: CreateOrderRequest): FinalizeResult {
  const issues: OrderValidationIssue[] = [];

  const phone = normalizeBdPhone(input.customerPhone);
  if (phone === null) {
    issues.push({
      field: "customerPhone",
      message:
        "customerPhone must be a Bangladeshi mobile number, e.g. 01712345678 (11 digits starting 013-019).",
    });
  }

  const items = input.items.map((item) => ({ ...item }));
  const itemsTotal = sumItems(items);

  if (itemsTotal <= 0) {
    issues.push({
      field: "items",
      message: "The items add up to 0 — every order needs at least one priced line.",
    });
  } else if (itemsTotal > ORDER_LIMITS.maxTotal) {
    issues.push({
      field: "items",
      message: `The items add up to ${itemsTotal}, above the ${ORDER_LIMITS.maxTotal} limit. Re-check the quantity and price.`,
    });
  }

  // A mismatch means the model's stated total disagrees with the lines it just
  // sent — usually a dropped or invented line. Rejecting is safer than silently
  // picking one of the two numbers, because either choice can bill the wrong
  // amount and the customer sees a confirmation it never agreed to.
  if (
    input.totalAmount !== undefined &&
    Math.abs(input.totalAmount - itemsTotal) > ORDER_LIMITS.totalTolerance
  ) {
    issues.push({
      field: "totalAmount",
      message: `totalAmount (${input.totalAmount}) does not match the items, which add up to ${itemsTotal}.`,
    });
  }

  // `|| phone === null` is redundant at runtime (a null phone always pushes an
  // issue) but it is what lets TypeScript narrow `phone` to a string below.
  if (issues.length > 0 || phone === null) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    order: {
      customerName: input.customerName,
      customerPhone: phone,
      deliveryAddress: input.deliveryAddress,
      district: input.district ?? "",
      items,
      totalAmount: itemsTotal,
    },
  };
}

// ─── Catalogue verification ───────────────────────────────────────────────────

/** The slice of a `Product` row this check needs. */
export type CatalogueProduct = {
  productId: string;
  name: string;
  price: number | null;
  isActive: boolean;
};

export type CatalogueResolution =
  | { ok: true; items: OrderItem[]; priceCorrections: number }
  | { ok: false; reason: string };

/**
 * Reconciles the model's item lines against rows fetched from `Product`.
 *
 * `catalogue` must already be scoped to the order's own `chatbotId` — the caller
 * does that in the query, which is what makes "id not found" and "id belongs to
 * another workspace" the same, safely-failing case here.
 *
 * A missing `productId` is allowed: a custom or unlisted item is a real thing a
 * merchant sells. A `productId` that does not resolve is not — it was invented
 * or borrowed from another store, and the order must not be written.
 */
export function resolveItemsAgainstCatalogue(
  items: readonly OrderItem[],
  catalogue: readonly CatalogueProduct[]
): CatalogueResolution {
  const byId = new Map(catalogue.map((product) => [product.productId, product]));
  const resolved: OrderItem[] = [];
  let priceCorrections = 0;

  for (const item of items) {
    if (!item.productId) {
      resolved.push({ ...item });
      continue;
    }

    const product = byId.get(item.productId);
    if (!product) {
      return {
        ok: false,
        reason: `Unknown productId "${item.productId}" for this chatbot. Use Product Lookup to get a real productId, or omit it for a custom item.`,
      };
    }

    if (!product.isActive) {
      return {
        ok: false,
        reason: `"${product.name}" is no longer available, so it cannot be ordered.`,
      };
    }

    // The live catalogue price always wins over the model's memory of it, so a
    // stale or invented number can never reach the invoice. A null price means
    // the merchant never set one, and the line's own price stands.
    const price = product.price ?? item.price;
    if (product.price !== null && product.price !== item.price) {
      priceCorrections += 1;
    }

    resolved.push({
      productId: product.productId,
      name: product.name,
      qty: item.qty,
      price,
    });
  }

  return { ok: true, items: resolved, priceCorrections };
}
