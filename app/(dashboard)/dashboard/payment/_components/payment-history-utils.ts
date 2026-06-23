import type { PlanKey } from "@/lib/domain/plan-config";

export interface PaymentTransactionMetadata {
  plan?: string;
  invoice_id?: string;
  local_reference?: string;
  payment_method?: string;
  paymentMethod?: string;
  transaction_id?: string;
  gateway_transaction_id?: string;
  gateway_invoice_id?: string;
  [key: string]: unknown;
}

export interface PaymentTransaction {
  id: string;
  sessionId: string;
  packageId: string;
  amount: number;
  currency: string;
  gateway: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  metadata?: PaymentTransactionMetadata | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
  card: "Card",
  visa: "Visa Card",
  mastercard: "Mastercard",
  stripe: "Card",
  uddoktapay: "Uddoktapay",
};

const GATEWAY_LABELS: Record<string, string> = {
  stripe: "Stripe",
  uddoktapay: "Uddoktapay",
};

export function normalizePaymentStatus(tx: PaymentTransaction): string {
  const value = String(tx.status || tx.paymentStatus || "pending").toLowerCase();

  if (["complete", "completed", "paid", "succeeded", "success"].includes(value)) {
    return "complete";
  }

  if (["cancelled", "canceled", "cancel"].includes(value)) {
    return "cancelled";
  }

  if (["failed", "failure", "declined", "error"].includes(value)) {
    return "failed";
  }

  if (["initiated", "processing"].includes(value)) {
    return "pending";
  }

  return value || "pending";
}

export function canDownloadInvoice(tx: PaymentTransaction): boolean {
  return ["complete", "pending"].includes(normalizePaymentStatus(tx));
}

export function getPlanKey(tx: PaymentTransaction): PlanKey {
  const rawPlan = tx.metadata?.plan || tx.packageId.split("_")[0] || "starter";
  return String(rawPlan).toLowerCase() as PlanKey;
}

export function formatGatewayLabel(gateway: string): string {
  const key = String(gateway || "").toLowerCase();
  return GATEWAY_LABELS[key] || titleCase(key || "unknown");
}

export function resolvePaymentMethod(tx: PaymentTransaction): string {
  const rawMethod =
    tx.metadata?.payment_method ||
    tx.metadata?.paymentMethod ||
    (tx.gateway === "stripe" ? "card" : tx.gateway);

  const key = String(rawMethod || "").toLowerCase().replace(/[\s_-]+/g, "");
  return PAYMENT_METHOD_LABELS[key] || titleCase(String(rawMethod || tx.gateway || "unknown"));
}

export function resolveTransactionReference(tx: PaymentTransaction): string {
  return String(
    tx.metadata?.transaction_id ||
      tx.metadata?.gateway_transaction_id ||
      tx.sessionId ||
      tx.id
  );
}

export function shortReference(reference: string): string {
  if (reference.length <= 16) return reference;
  return `${reference.slice(0, 12)}...`;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
