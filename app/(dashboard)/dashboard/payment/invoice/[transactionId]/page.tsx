"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, Download, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InvoiceSummaryCard } from "./_components/InvoiceSummaryCard";

/**
 * Merchant Invoice Page — `/dashboard/payment/invoice/[transactionId]`
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin যে invoice পাঠিয়েছে তা এখানে দেখা যায় এবং "Pay Now" দিয়ে পরিশোধ করা যায়।
 *
 * কেন dashboard-এর ভেতরে (public guest page নয়): invoice দেখতে login লাগে,
 * তাই URL leak হলেও অন্যের invoice দেখা যায় না — ownership check server-এ হয়।
 *
 * ⚠️ Email-এ সরাসরি gateway link দেওয়া হয় না — gateway session expire হয় ও
 * link share করা অনিরাপদ। Email এই page-এ নিয়ে আসে, এখান থেকে payment শুরু হয়।
 */

interface InvoiceDetails {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  kind: string;
  description: string;
  creditsToGrant: number | null;
  plan: string | null;
  paymentStatus: string;
  status: string;
  failureReason: string | null;
  refundStatus: string | null;
  createdAt: string;
  isPayable: boolean;
}

/** paymentStatus → badge tone। */
function resolveTone(invoice: InvoiceDetails): "pending" | "success" | "danger" | "muted" {
  if (invoice.paymentStatus === "paid" || invoice.status === "complete") return "success";
  if (["failed", "cancelled", "disputed"].includes(invoice.paymentStatus)) return "danger";
  if (invoice.paymentStatus === "pending") return "pending";
  return "muted";
}

export default function InvoicePage() {
  const { t } = useTranslation("payment");
  const router = useRouter();
  const params = useParams<{ transactionId: string }>();
  const transactionId = params?.transactionId;

  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!transactionId) return;

    try {
      const res = await fetch(`/api/payments/invoice/${transactionId}/details`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load invoice");

      setInvoice(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePay = async () => {
    if (!invoice) return;

    setPaying(true);
    try {
      const res = await fetch(`/api/payments/invoice/${invoice.id}/pay`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || t("invoice.payError"));
      }

      window.location.assign(data.url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("invoice.payError"));
      setPaying(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">{t("invoice.loading")}</p>
        </div>
      </div>
    );
  }

  // ── Not found / not owned ──
  if (notFound || !invoice) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{t("invoice.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("invoice.notFoundDesc")}</p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/payment")}>
          {t("success.btnReturn")}
        </Button>
      </motion.div>
    );
  }

  const statusLabel = t(`invoice.statuses.${invoice.paymentStatus}`, invoice.paymentStatus);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => router.push("/dashboard/payment/history")}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("history.title", "Billing History")}
      </Button>

      <InvoiceSummaryCard
        invoiceNumber={invoice.invoiceNumber}
        description={invoice.description}
        amount={invoice.amount}
        currency={invoice.currency}
        statusLabel={statusLabel}
        statusTone={resolveTone(invoice)}
        issuedOn={format(new Date(invoice.createdAt), "PP")}
        creditsToGrant={invoice.creditsToGrant}
        plan={invoice.plan}
        labels={{
          amountDue: t("invoice.amountDue"),
          description: t("invoice.description"),
          invoiceNumber: t("invoice.invoiceNumber"),
          issuedOn: t("invoice.issuedOn"),
          status: t("invoice.status"),
          creditsToReceive: t("invoice.creditsToReceive"),
          planToActivate: t("invoice.planToActivate"),
        }}
      />

      {/* ব্যর্থ payment-এর কারণ থাকলে দেখানো হয় */}
      {invoice.failureReason && !invoice.isPayable && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">{invoice.failureReason}</p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="space-y-3">
        {invoice.isPayable ? (
          <>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {paying ? t("invoice.processing") : t("invoice.payNow")}
            </Button>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {t("invoice.secureNote")}
            </p>
          </>
        ) : (
          <p className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
            {invoice.paymentStatus === "paid"
              ? t("invoice.alreadyPaid")
              : /* non-BDT invoice-এ কোনো gateway নেই — admin offline নিষ্পত্তি করেন */
                invoice.currency !== "bdt" && invoice.paymentStatus === "pending"
                ? t("invoice.offlineOnly")
                : t("invoice.notPayable")}
          </p>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open(`/api/payments/invoice/${invoice.id}`, "_blank")}
        >
          <Download className="h-4 w-4" />
          {t("invoice.downloadPdf")}
        </Button>
      </div>
    </div>
  );
}
