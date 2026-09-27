"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Copy,
  Loader2,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefundDialog, type RefundTarget } from "@/components/admin/billing/RefundDialog";
import { cn } from "@/lib/utils";

/**
 * Payment Issues Panel — `/admin/billing` → "Payment Issues" tab
 * ─────────────────────────────────────────────────────────────────────────────
 * ব্যর্থ payment, duplicate payment, chargeback (dispute) ও merchant-এর refund
 * request — সব এক queue-তে। এটিই সেই জায়গা যেখানে admin payment সংক্রান্ত
 * সমস্যার নিষ্পত্তি করেন।
 *
 * ডেটা আসে `GET /api/admin/billing?type=issues` থেকে; প্রতিটি action যায়
 * `POST /api/admin/billing`-এ `action` discriminator দিয়ে। কোনো টাকা বা credit
 * এখানে সরাসরি বদলায় না — সব `lib/services/*`-এ হয়।
 */

interface PaymentIssue {
  transactionId: string;
  sessionId: string;
  invoiceNumber: string | null;
  kind: string;
  amount: number;
  currency: string;
  gateway: string;
  paymentStatus: string;
  issueType: "disputed" | "refund_requested" | "duplicate" | "failed" | "cancelled";
  reason: string | null;
  failureCode: string | null;
  duplicateOfId: string | null;
  refundStatus: string | null;
  refundRequestId: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { userId: string; name: string; email: string; picture: string | null };
}

interface PaymentIssuesPanelProps {
  /** দিলে শুধু ওই merchant-এর issue দেখানো হয় (workspace deep-link)। */
  userId?: string;
  /** issue সংখ্যা বাইরে জানানোর জন্য (tab badge / workspace card)। */
  onCountChange?: (count: number) => void;
}

/** issueType → আইকন, রঙ ও translation key। রঙ সবই CSS variable-ভিত্তিক। */
const ISSUE_META: Record<
  PaymentIssue["issueType"],
  { icon: typeof AlertTriangle; className: string; key: string }
> = {
  disputed: {
    icon: ShieldAlert,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    key: "disputed",
  },
  refund_requested: {
    icon: Undo2,
    className: "border-warning/30 bg-warning/10 text-warning",
    key: "refundRequested",
  },
  duplicate: {
    icon: Copy,
    className: "border-primary/25 bg-primary/10 text-primary",
    key: "duplicate",
  },
  failed: {
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    key: "failed",
  },
  cancelled: {
    icon: AlertTriangle,
    className: "border-border bg-muted/60 text-muted-foreground",
    key: "cancelled",
  },
};

export function PaymentIssuesPanel({ userId, onCountChange }: PaymentIssuesPanelProps) {
  const { t } = useTranslation("admin");

  const [issues, setIssues] = useState<PaymentIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "issues" });
      if (userId) params.set("userId", userId);

      const res = await fetch(`/api/admin/billing?${params}`);
      if (!res.ok) throw new Error();

      const data = await res.json();
      setIssues(data.issues ?? []);
      onCountChange?.(data.total ?? 0);
    } catch {
      toast.error(t("billing.loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, onCountChange, t]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const runAction = async (
    body: Record<string, unknown>,
    transactionId: string,
    successMessage: string
  ) => {
    setBusyId(transactionId);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("billing.issues.actionError"));

      toast.success(successMessage);
      await fetchIssues();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("billing.issues.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = (issue: PaymentIssue) =>
    runAction(
      { action: "retry_payment", transactionId: issue.transactionId },
      issue.transactionId,
      t("billing.issues.retrySuccess")
    );

  const handleDismiss = (issue: PaymentIssue) =>
    runAction(
      { action: "resolve_issue", transactionId: issue.transactionId },
      issue.transactionId,
      t("billing.issues.dismissSuccess")
    );

  const handleResolveRequest = (issue: PaymentIssue, decision: "approved" | "rejected") => {
    if (!issue.refundRequestId) return;
    return runAction(
      { action: "resolve_request", requestId: issue.refundRequestId, decision },
      issue.transactionId,
      decision === "approved"
        ? t("billing.issues.approveSuccess")
        : t("billing.issues.rejectSuccess")
    );
  };

  const openRefund = (issue: PaymentIssue) =>
    setRefundTarget({
      transactionId: issue.transactionId,
      merchantName: issue.user.name,
      invoiceNumber: issue.invoiceNumber,
      amount: issue.amount,
      currency: issue.currency,
      gateway: issue.gateway,
    });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs font-medium text-muted-foreground">
            {t("billing.issues.queueLabel", { count: issues.length })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 rounded-lg gap-1.5 text-xs"
          onClick={fetchIssues}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          <span className="hidden sm:inline">{t("billing.refresh")}</span>
        </Button>
      </div>

      {loading && !issues.length ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {t("billing.loading")}
        </div>
      ) : !issues.length ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("billing.issues.empty")}
        </div>
      ) : (
        <>
          {/* Column headers — শুধু md+ এ, mobile-এ card layout */}
          <div className="hidden border-b border-border/50 bg-muted/30 px-5 py-3 md:grid md:grid-cols-6 md:gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("billing.table.user")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("billing.table.amount")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("billing.issues.table.issue")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("billing.issues.table.reason")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("billing.table.date")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 md:text-right">
              {t("billing.issues.table.actions")}
            </span>
          </div>

          <ul className="divide-y divide-border/40">
            {issues.map((issue, index) => {
              // API শুধু পাঁচটি known type ফেরত দেয়, তবু fallback রাখা হয় —
              // একটি অজানা row যেন পুরো admin page white-screen না করে।
              const meta = ISSUE_META[issue.issueType] ?? ISSUE_META.failed;
              const IssueIcon = meta.icon;
              const busy = busyId === issue.transactionId;

              return (
                <motion.li
                  key={issue.transactionId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                  className="grid grid-cols-1 gap-y-2 px-5 py-4 transition-colors hover:bg-primary/[0.04] md:grid md:grid-cols-6 md:items-center md:gap-4"
                >
                  {/* Merchant */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-primary/15">
                      <AvatarImage src={issue.user.picture ?? undefined} alt={issue.user.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {issue.user.name ? issue.user.name.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold leading-tight text-foreground">
                        {issue.user.name}
                      </p>
                      <p className="truncate text-[11px] leading-tight text-muted-foreground">
                        {issue.user.email}
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {issue.currency.toUpperCase()} {issue.amount.toLocaleString()}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {issue.invoiceNumber ?? issue.gateway}
                    </p>
                  </div>

                  {/* Issue type */}
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                        meta.className
                      )}
                    >
                      <IssueIcon className="h-3 w-3" />
                      {t(`billing.issues.types.${meta.key}`)}
                    </Badge>
                  </div>

                  {/* Reason */}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground" title={issue.reason ?? ""}>
                      {issue.reason ?? "—"}
                    </p>
                    {issue.refundStatus ? (
                      <p className="truncate text-[10px] text-muted-foreground/80">
                        {t("billing.issues.refundStatusLabel")}: {issue.refundStatus}
                      </p>
                    ) : null}
                  </div>

                  {/* Date */}
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  <div className="flex md:justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-lg text-xs"
                            disabled={busy}
                          />
                        }
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        )}
                        {t("billing.issues.table.actions")}
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-52 rounded-xl">
                        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                          {issue.invoiceNumber ?? issue.sessionId}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {/* Refund request থাকলে সিদ্ধান্ত নেওয়া হয় */}
                        {issue.refundRequestId ? (
                          <>
                            <DropdownMenuItem onClick={() => handleResolveRequest(issue, "approved")}>
                              <Undo2 className="h-3.5 w-3.5" />
                              {t("billing.issues.actions.approveRequest")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResolveRequest(issue, "rejected")}>
                              <XCircle className="h-3.5 w-3.5" />
                              {t("billing.issues.actions.rejectRequest")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}

                        {/* ব্যর্থ/বাতিল payment আবার চেষ্টা করা যায় */}
                        {(issue.issueType === "failed" || issue.issueType === "cancelled") && (
                          <DropdownMenuItem onClick={() => handleRetry(issue)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            {t("billing.issues.actions.retry")}
                          </DropdownMenuItem>
                        )}

                        {/* Refund এখন সব gateway-এ manual (record only) —
                            কোনো gateway API টাকা ফেরত পাঠায় না। */}
                        <DropdownMenuItem onClick={() => openRefund(issue)}>
                          <Receipt className="h-3.5 w-3.5" />
                          {t("billing.issues.actions.refundManual")}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDismiss(issue)}>
                          <XCircle className="h-3.5 w-3.5" />
                          {t("billing.issues.actions.dismiss")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </>
      )}

      <RefundDialog
        open={refundTarget !== null}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        target={refundTarget}
        onSuccess={fetchIssues}
      />
    </div>
  );
}
