"use client";

import { motion } from "framer-motion";

interface InvoiceSummaryCardProps {
  invoiceNumber: string | null;
  description: string;
  amount: number;
  currency: string;
  statusLabel: string;
  statusTone: "pending" | "success" | "danger" | "muted";
  issuedOn: string;
  creditsToGrant: number | null;
  plan: string | null;
  labels: {
    amountDue: string;
    description: string;
    invoiceNumber: string;
    issuedOn: string;
    status: string;
    creditsToReceive: string;
    planToActivate: string;
  };
}

/**
 * status অনুযায়ী badge-এর রঙ — সবই `globals.css`-এর CSS variable, তাই
 * light/dark দুটো theme-এই নিজে থেকে খাপ খায় (hard-coded রঙ নেই)।
 */
const TONE_CLASSES: Record<InvoiceSummaryCardProps["statusTone"], string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
};

/**
 * Invoice-এর মূল তথ্য — amount, description, status ও কী পাওয়া যাবে।
 * ছোট, pure presentational component; কোনো fetch বা state নেই।
 */
export function InvoiceSummaryCard({
  invoiceNumber,
  description,
  amount,
  currency,
  statusLabel,
  statusTone,
  issuedOn,
  creditsToGrant,
  plan,
  labels,
}: InvoiceSummaryCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm"
    >
      {/* Header — gradient theme token দিয়ে */}
      <header className="bg-gradient-to-r from-primary/10 via-secondary/20 to-transparent px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.amountDue}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {amount.toLocaleString()}
              <span className="ml-2 text-lg font-semibold text-muted-foreground">
                {currency.toUpperCase()}
              </span>
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${TONE_CLASSES[statusTone]}`}
          >
            {statusLabel}
          </span>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </header>

      <dl className="divide-y divide-border/60">
        {invoiceNumber && <Row label={labels.invoiceNumber} value={invoiceNumber} mono />}
        <Row label={labels.issuedOn} value={issuedOn} />
        <Row label={labels.status} value={statusLabel} />
        {creditsToGrant ? (
          <Row label={labels.creditsToReceive} value={creditsToGrant.toLocaleString()} emphasis />
        ) : null}
        {plan ? <Row label={labels.planToActivate} value={plan.toUpperCase()} emphasis /> : null}
      </dl>
    </motion.section>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}

function Row({ label, value, mono, emphasis }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-7">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={[
          "text-right text-sm font-semibold",
          mono ? "font-mono" : "",
          emphasis ? "text-primary" : "text-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
