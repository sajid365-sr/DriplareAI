export const WORKSPACE_BUSINESS_CATEGORY_IDS = [
  "ecommerce",
  "healthcare",
  "restaurant",
  "travel",
  "real_estate",
  "education",
  "lead_gen",
  "custom",
] as const;

export const WORKSPACE_BUSINESS_CATEGORIES = [
  { id: "ecommerce", labelKey: "workspace.categories.ecommerce", label: "E-Commerce / Online Shop" },
  { id: "healthcare", labelKey: "workspace.categories.healthcare", label: "Healthcare / Clinic" },
  { id: "restaurant", labelKey: "workspace.categories.restaurant", label: "Restaurant / Food Delivery" },
  { id: "travel", labelKey: "workspace.categories.travel", label: "Tour & Travel" },
  { id: "real_estate", labelKey: "workspace.categories.realEstate", label: "Real Estate / Property" },
  { id: "education", labelKey: "workspace.categories.education", label: "Education / Coaching" },
  { id: "lead_gen", labelKey: "workspace.categories.leadGen", label: "Lead Generation / Services" },
  { id: "custom", labelKey: "workspace.categories.custom", label: "Custom / Other Business" },
] as const;

export type WorkspaceBusinessCategory =
  (typeof WORKSPACE_BUSINESS_CATEGORY_IDS)[number];

export function isWorkspaceBusinessCategory(
  value: unknown
): value is WorkspaceBusinessCategory {
  return (
    typeof value === "string" &&
    WORKSPACE_BUSINESS_CATEGORIES.some((category) => category.id === value)
  );
}
