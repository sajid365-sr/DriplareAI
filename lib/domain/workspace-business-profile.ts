import { z } from "zod";

const nonNegativeAmount = z.number().finite().min(0).max(1_000_000);

export const DeliveryZoneSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  areas: z.array(z.string().trim().min(1).max(100)).max(30),
  charge: nonNegativeAmount,
  fastestDays: z.number().int().min(0).max(365),
  slowestDays: z.number().int().min(0).max(365),
}).superRefine((zone, context) => {
  if (zone.slowestDays < zone.fastestDays) {
    context.addIssue({ code: "custom", path: ["slowestDays"], message: "Maximum delivery days cannot be less than minimum days" });
  }
  if (zone.areas.length === 0) {
    context.addIssue({ code: "custom", path: ["areas"], message: "Add at least one area alias for safe delivery matching" });
  }
});

export const WorkspaceDeliveryPolicySchema = z.object({
  currency: z.string().trim().min(3).max(5).default("BDT"),
  zones: z.array(DeliveryZoneSchema).max(20).default([]),
  freeDeliveryMinimum: nonNegativeAmount.nullable().default(null),
});

export type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;
export type WorkspaceDeliveryPolicy = z.infer<typeof WorkspaceDeliveryPolicySchema>;

export type DeliveryFeeResolution =
  | { ok: true; fee: number; zone: DeliveryZone }
  | { ok: false; reason: "no_matching_zone" | "ambiguous_zone" | "fee_mismatch"; expectedFee?: number };

function normalizeArea(value: string): string {
  const digits = "০১২৩৪৫৬৭৮৯";
  return value
    .replace(/[০-৯]/g, (digit) => String(digits.indexOf(digit)))
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Resolves a merchant-configured delivery zone and checks the customer-confirmed charge. */
export function resolveDeliveryFee(
  policy: WorkspaceDeliveryPolicy,
  destination: string,
  itemsSubtotal: number,
  submittedFee: number
): DeliveryFeeResolution {
  const normalizedDestination = normalizeArea(destination);
  const matches = policy.zones.flatMap((zone) => {
    const aliases = [zone.name, ...zone.areas]
      .map(normalizeArea)
      .filter((alias) => alias.length >= 3 && normalizedDestination.includes(alias));
    const specificity = aliases.length ? Math.max(...aliases.map((alias) => alias.length)) : 0;
    return specificity ? [{ zone, specificity }] : [];
  });
  if (matches.length === 0) return { ok: false, reason: "no_matching_zone" };
  const maxSpecificity = Math.max(...matches.map((match) => match.specificity));
  const bestMatches = matches.filter((match) => match.specificity === maxSpecificity);
  if (bestMatches.length !== 1) return { ok: false, reason: "ambiguous_zone" };

  const zone = bestMatches[0].zone;
  const qualifiesForFreeDelivery = policy.freeDeliveryMinimum !== null
    && itemsSubtotal >= policy.freeDeliveryMinimum;
  const expectedFee = qualifiesForFreeDelivery ? 0 : zone.charge;
  if (Math.abs(submittedFee - expectedFee) > 0.01) {
    return { ok: false, reason: "fee_mismatch", expectedFee };
  }
  return { ok: true, fee: expectedFee, zone };
}

export function formatWorkspaceDeliveryPolicy(value: unknown): string {
  const parsed = WorkspaceDeliveryPolicySchema.safeParse(value);
  if (!parsed.success || parsed.data.zones.length === 0) return "";
  const { currency, zones, freeDeliveryMinimum } = parsed.data;
  const zoneLines = zones.map((zone) => {
    const areas = zone.areas.join(", ");
    const eta = zone.fastestDays === zone.slowestDays
      ? String(zone.fastestDays) + " day(s)"
      : String(zone.fastestDays) + "-" + String(zone.slowestDays) + " days";
    return "- " + zone.name + " (areas: " + areas + "): delivery charge " + zone.charge + " " + currency + "; estimated delivery " + eta + ".";
  });
  if (freeDeliveryMinimum !== null) {
    zoneLines.push("Free delivery applies when the product subtotal is at least " + freeDeliveryMinimum + " " + currency + ".");
  }
  return zoneLines.join("\n");
}
