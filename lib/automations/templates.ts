/**
 * Automation engine — message variable interpolation.
 *
 * Merchants write things like "ধন্যবাদ {{name}}! আপনার অর্ডার {{order_id}}".
 * This resolves those placeholders against the facts the engine already has,
 * so the same template works across channels without per-channel copies.
 *
 * Design rule: an unknown or missing variable resolves to an empty string, and
 * the surrounding whitespace is tidied up. Leaving a literal "{{name}}" in a
 * customer-facing message looks broken; leaving "ধন্যবাদ !" does not.
 */

export interface TemplateVariables {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  orderId?: string | null;
  orderTotal?: string | null;
  product?: string | null;
  pageName?: string | null;
  agentName?: string | null;
}

/** Everything a merchant can insert, in the order the builder lists them. */
export const TEMPLATE_VARIABLE_KEYS = [
  "name",
  "phone",
  "address",
  "district",
  "order_id",
  "order_total",
  "product",
  "page_name",
  "agent_name",
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLE_KEYS)[number];

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

function resolve(key: string, vars: TemplateVariables): string {
  switch (key.toLowerCase()) {
    case "name":
      return vars.name ?? "";
    case "phone":
      return vars.phone ?? "";
    case "address":
      return vars.address ?? "";
    case "district":
      return vars.district ?? "";
    case "order_id":
      return vars.orderId ?? "";
    case "order_total":
      return vars.orderTotal ?? "";
    case "product":
      return vars.product ?? "";
    case "page_name":
      return vars.pageName ?? "";
    case "agent_name":
      return vars.agentName ?? "";
    default:
      return "";
  }
}

/**
 * Replace `{{key}}` placeholders with their values.
 *
 * Note the two cleanups after substitution: the merchant typed the spacing
 * around the placeholder assuming a value would be there, so removing the
 * value has to remove the gap it left behind.
 */
export function renderTemplate(body: string, vars: TemplateVariables): string {
  return body
    .replace(VARIABLE_PATTERN, (_match, key: string) => resolve(key, vars))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?।])/g, "$1")
    .trim();
}

/** Keys actually used by a template — powers the "missing variables" warning. */
export function extractTemplateKeys(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}
