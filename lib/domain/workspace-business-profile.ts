import { z } from "zod";

const nonNegativeAmount = z.number().finite().min(0).max(1_000_000);

export const WorkspaceBusinessProfileFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "url",
  "boolean",
]);

export const WorkspaceBusinessProfileCustomFieldSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(60),
  type: WorkspaceBusinessProfileFieldTypeSchema,
  value: z.string().max(2000),
}).superRefine((field, context) => {
  if (field.type === "number" && field.value.trim() && !Number.isFinite(Number(field.value))) {
    context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid number" });
  }
  if (field.type === "url" && field.value.trim()) {
    try {
      const url = new URL(field.value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        context.addIssue({ code: "custom", path: ["value"], message: "Use an HTTP or HTTPS URL" });
      }
    } catch {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid URL" });
    }
  }
  if (field.type === "boolean" && field.value !== "" && field.value !== "true" && field.value !== "false") {
    context.addIssue({ code: "custom", path: ["value"], message: "Choose yes or no" });
  }
});

export type WorkspaceBusinessProfileFieldType = z.infer<typeof WorkspaceBusinessProfileFieldTypeSchema>;
export type WorkspaceBusinessProfileCustomField = z.infer<typeof WorkspaceBusinessProfileCustomFieldSchema>;

export type WorkspaceBusinessProfileTemplateField = {
  key: string;
  type: "text" | "textarea";
};

const CATEGORY_PROFILE_FIELDS: Record<string, WorkspaceBusinessProfileTemplateField[]> = {
  ecommerce: [
    { key: "productCategories", type: "textarea" },
    { key: "brands", type: "text" },
  ],
  restaurant: [
    { key: "cuisine", type: "text" },
    { key: "serviceOptions", type: "textarea" },
  ],
  healthcare: [
    { key: "specialties", type: "textarea" },
    { key: "appointmentTypes", type: "textarea" },
  ],
  travel: [
    { key: "travelServices", type: "textarea" },
    { key: "popularDestinations", type: "textarea" },
  ],
  real_estate: [
    { key: "propertyTypes", type: "textarea" },
    { key: "serviceAreas", type: "textarea" },
  ],
  education: [
    { key: "programs", type: "textarea" },
    { key: "studentLevels", type: "text" },
  ],
  lead_gen: [
    { key: "servicesOffered", type: "textarea" },
    { key: "serviceAreas", type: "textarea" },
  ],
};

export function getWorkspaceBusinessProfileFields(category: string | null | undefined): WorkspaceBusinessProfileTemplateField[] {
  return CATEGORY_PROFILE_FIELDS[category?.trim().toLowerCase() ?? ""] ?? [];
}

export const WorkspaceBusinessProfileCategoryFieldsSchema = z.record(
  z.string().trim().min(1).max(80),
  z.string().trim().max(2000)
);

export const WorkspaceBusinessProfileCustomFieldsSchema = z.array(
  WorkspaceBusinessProfileCustomFieldSchema
).max(20).superRefine((fields, context) => {
  const ids = new Set<string>();
  const labels = new Set<string>();
  fields.forEach((field, index) => {
    const normalizedLabel = field.label.toLocaleLowerCase();
    if (ids.has(field.id)) {
      context.addIssue({ code: "custom", path: [index, "id"], message: "Field IDs must be unique" });
    }
    if (labels.has(normalizedLabel)) {
      context.addIssue({ code: "custom", path: [index, "label"], message: "Field names must be unique" });
    }
    ids.add(field.id);
    labels.add(normalizedLabel);
  });
});

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
