"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  Copy,
  CreditCard,
  Download,
  Hash,
  Landmark,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveLocalStr, getPlan } from "@/lib/domain/plan-config";
import { useRegion } from "@/components/region-provider";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import {
  canDownloadInvoice,
  formatGatewayLabel,
  getPlanKey,
  normalizePaymentStatus,
  resolvePaymentMethod,
  resolveTransactionReference,
  type PaymentTransaction,
} from "./payment-history-utils";

interface TransactionDetailsModalProps {
  transaction: PaymentTransaction | null;
  open: boolean;
  downloadingId: string | null;
  onOpenChange: (open: boolean) => void;
  onCopyTransactionId: (transaction: PaymentTransaction) => void;
  onDownloadInvoice: (transaction: PaymentTransaction) => void;
}

export function TransactionDetailsModal({
  transaction,
  open,
  downloadingId,
  onOpenChange,
  onCopyTransactionId,
  onDownloadInvoice,
}: TransactionDetailsModalProps) {
  const { t, i18n } = useTranslation("payment");
  const { region } = useRegion();

  if (!transaction) return null;

  const normalizedStatus = normalizePaymentStatus(transaction);
  const plan = getPlan(region, getPlanKey(transaction));
  const reference = resolveTransactionReference(transaction);
  const gatewayLabel = formatGatewayLabel(transaction.gateway);
  const paymentMethod = resolvePaymentMethod(transaction);
  const invoiceAvailable = canDownloadInvoice(transaction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("history.modal.title", "Transaction Details")}
            </DialogTitle>
            <DialogDescription>
              {t("history.modal.description", "Review payment metadata, gateway details, and invoice actions.")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailItem
              icon={<Hash className="h-4 w-4" />}
              label={t("history.modal.transactionId", "Transaction ID")}
              value={reference}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onCopyTransactionId(transaction)}
                  aria-label={t("history.copyTransactionId", "Copy transaction ID")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              }
              mono
            />
            <DetailItem
              icon={<CalendarClock className="h-4 w-4" />}
              label={t("history.modal.paymentDate", "Payment Date")}
              value={format(new Date(transaction.createdAt), "PPpp")}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t("history.modal.summary", "Payment Summary")}
                </h3>
              </div>
              <PaymentStatusBadge
                status={normalizedStatus}
                label={t(`history.status.${normalizedStatus}`, normalizedStatus)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SummaryMetric
                label={t("history.package", "Package")}
                value={resolveLocalStr(plan.name, i18n.language)}
              />
              <SummaryMetric
                label={t("history.amount", "Amount")}
                value={`${transaction.amount.toLocaleString()} ${transaction.currency.toUpperCase()}`}
              />
              <SummaryMetric
                label={t("history.status.label", "Status")}
                value={t(`history.status.${normalizedStatus}`, normalizedStatus)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DetailItem
              icon={<CreditCard className="h-4 w-4" />}
              label={t("history.paymentMethod", "Payment Method")}
              value={paymentMethod}
            />
            <DetailItem
              icon={<Landmark className="h-4 w-4" />}
              label={t("history.gateway", "Gateway")}
              value={gatewayLabel}
            />
          </div>
        </div>

        <DialogFooter className="m-0 rounded-none px-6 py-4">
          {invoiceAvailable && (
            <Button
              type="button"
              className="w-full gap-2 sm:w-auto"
              onClick={() => onDownloadInvoice(transaction)}
              disabled={downloadingId === transaction.id}
            >
              {downloadingId === transaction.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("history.downloadPdf", "Download PDF")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DetailItemProps {
  icon: ReactNode;
  label: string;
  value: string;
  action?: ReactNode;
  mono?: boolean;
}

function DetailItem({ icon, label, value, action, mono }: DetailItemProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={mono ? "break-all font-mono text-sm text-foreground" : "text-sm font-semibold text-foreground"}>
          {value}
        </p>
        {action}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
