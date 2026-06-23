"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  FileText,
  CreditCard,
  Calendar as CalendarIcon,
  DollarSign,
  ChevronRight,
  Loader2,
  AlertCircle,
  ChevronLeft,
  X,
  Copy,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { resolveLocalStr, getPlan } from "@/lib/domain/plan-config";
import { useRegion } from "@/components/region-provider";
import { cn } from "@/lib/core/utils";
import { PaymentStatusBadge } from "../_components/PaymentStatusBadge";
import { TransactionDetailsModal } from "../_components/TransactionDetailsModal";
import {
  canDownloadInvoice,
  getPlanKey,
  normalizePaymentStatus,
  resolvePaymentMethod,
  resolveTransactionReference,
  shortReference,
  type PaymentTransaction,
} from "../_components/payment-history-utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

export default function BillingHistoryPage() {
  const { t, i18n } = useTranslation("payment");
  const { region } = useRegion();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetch("/api/payments/history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          toast.error(t("history.loadError", "Failed to load billing history"));
        }
      })
      .catch(() => toast.error(t("history.genericError", "An error occurred")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (searchParams.get("cancelled") === "true") {
      toast.info(t("history.cancelledNotice", "Payment was cancelled and moved to your history."));
    }
  }, [searchParams, t]);

  const downloadInvoice = async (tx: PaymentTransaction) => {
    if (!canDownloadInvoice(tx)) {
      toast.warning(t("history.invoiceUnavailable", "Invoice is not available for this transaction."));
      return;
    }
    setDownloadingId(tx.id);
    try {
      const res = await fetch(`/api/payments/invoice/${tx.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate invoice");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `driplare-invoice-${tx.id.slice(-6).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t("history.invoiceDownloaded", "Invoice downloaded successfully!"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("history.invoiceDownloadError", "Failed to download invoice");
      toast.error(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const copyTransactionId = async (tx: PaymentTransaction) => {
    const reference = resolveTransactionReference(tx);
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(t("history.copySuccess", "Transaction ID copied."));
    } catch {
      toast.error(t("history.copyError", "Unable to copy transaction ID."));
    }
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const updateDateRange = (value: DateRange | undefined) => {
    setDateRange(value);
    setCurrentPage(1);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const query = search.toLowerCase();
      const reference = resolveTransactionReference(tx).toLowerCase();
      const matchesSearch =
        tx.sessionId.toLowerCase().includes(query) ||
        tx.packageId.toLowerCase().includes(query) ||
        reference.includes(query);
      const matchesStatus =
        statusFilter === "all" || normalizePaymentStatus(tx) === statusFilter;

      let matchesDate = true;
      if (dateRange?.from && dateRange?.to) {
        const txDate = new Date(tx.createdAt);
        matchesDate = isWithinInterval(txDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else if (dateRange?.from) {
        const txDate = new Date(tx.createdAt);
        matchesDate = txDate >= startOfDay(dateRange.from);
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [transactions, search, statusFilter, dateRange]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const paginationStart = (currentPage - 1) * itemsPerPage + 1;
  const paginationEnd = Math.min(currentPage * itemsPerPage, filteredTransactions.length);

  const stats = useMemo(() => {
    const completed = transactions.filter(t => normalizePaymentStatus(t) === "complete");
    const totalSpent = completed.reduce((sum, t) => sum + t.amount, 0);
    const lastPayment = completed.length > 0 ? completed[0] : null;
    return { totalSpent, count: completed.length, lastPayment };
  }, [transactions]);

  const downloadCSV = () => {
    const headers = ["Date", "Transaction ID", "Package", "Amount", "Currency", "Payment Method", "Status"];
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm"),
      resolveTransactionReference(tx),
      tx.packageId,
      tx.amount,
      tx.currency,
      resolvePaymentMethod(tx),
      normalizePaymentStatus(tx)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `billing_history_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(t("history.reportTitle", "Billing History Report"), 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(t("history.generatedOn", "Generated on: {{date}}", { date: format(new Date(), "PPP p") }), 14, 30);
    doc.text(t("history.platform", "Platform: REMOVED AI"), 14, 35);
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(t("history.summary", "Summary"), 14, 48);
    doc.setFontSize(10);
    doc.text(t("history.totalSuccessfulPayments", "Total Successful Payments: {{count}}", { count: stats.count }), 14, 55);
    doc.text(
      t("history.totalAmountSpent", "Total Amount Spent: {{amount}} {{currency}}", {
        amount: stats.totalSpent,
        currency: transactions[0]?.currency || "",
      }),
      14,
      60
    );
    const tableHeaders = [[
      t("history.date", "Date"),
      t("history.reference", "Reference"),
      t("history.plan", "Plan"),
      t("history.amount", "Amount"),
      t("history.gateway", "Gateway"),
      t("history.status.label", "Status"),
    ]];
    const tableData = filteredTransactions.map(tx => [
      format(new Date(tx.createdAt), "MMM d, yyyy"),
      resolveTransactionReference(tx).slice(-8).toUpperCase(),
      tx.packageId.split("_")[0].toUpperCase(),
      `${tx.amount} ${tx.currency}`,
      resolvePaymentMethod(tx),
      normalizePaymentStatus(tx).toUpperCase()
    ]);
    autoTable(doc, {
      startY: 70,
      head: tableHeaders,
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [109, 40, 217] },
      margin: { top: 70 },
    });
    doc.save(`billing_history_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          {t("history.loading", "Loading your billing history...")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">{t("history.totalSpent", "Total Spent")}</p>
              <p className="text-2xl font-bold">{stats.totalSpent.toLocaleString()} {transactions[0]?.currency || ""}</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary text-secondary-foreground"><CalendarIcon className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">{t("history.lastPayment", "Last Payment")}</p>
              <p className="text-lg font-bold">
                {stats.lastPayment ? format(new Date(stats.lastPayment.createdAt), "MMM d, yyyy") : t("history.notAvailable", "N/A")}
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent text-accent-foreground"><CreditCard className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">{t("history.transactions", "Transactions")}</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-2xl border border-border/50">
        <div className="flex flex-wrap flex-1 items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("history.searchPlaceholder", "Search by ID or package...")}
              className="pl-10 rounded-xl h-10"
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
            value={statusFilter}
            onChange={(e) => updateStatusFilter(e.target.value)}
          >
            <option value="all">{t("history.status.all", "All Status")}</option>
            <option value="complete">{t("history.status.complete", "Complete")}</option>
            <option value="pending">{t("history.status.pending", "Pending")}</option>
            <option value="failed">{t("history.status.failed", "Failed")}</option>
            <option value="cancelled">{t("history.status.cancelled", "Cancelled")}</option>
          </select>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[280px] justify-start text-left font-normal h-10 rounded-xl",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>{t("history.pickDate", "Pick a date")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={updateDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {dateRange?.from && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => updateDateRange({ from: undefined, to: undefined })}
                className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-destructive/10"
                aria-label={t("history.clearDate", "Clear date filter")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={downloadCSV} className="rounded-xl flex-1 md:flex-none h-10">
            <Download className="w-4 h-4 mr-2" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPDF} className="rounded-xl flex-1 md:flex-none h-10">
            <FileText className="w-4 h-4 mr-2" />PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                <th className="px-6 py-4">{t("history.date", "Date")}</th>
                <th className="px-6 py-4">{t("history.package", "Package")}</th>
                <th className="px-6 py-4">{t("history.amount", "Amount")}</th>
                <th className="px-6 py-4">{t("history.gateway", "Gateway")}</th>
                <th className="px-6 py-4">{t("history.status.label", "Status")}</th>
                <th className="px-6 py-4">{t("history.transactionId", "Transaction ID")}</th>
                <th className="px-6 py-4 text-right">{t("history.action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((tx) => {
                    const planKey = getPlanKey(tx);
                    const plan = getPlan(region, planKey);
                    const normalizedStatus = normalizePaymentStatus(tx);
                    const reference = resolveTransactionReference(tx);
                    return (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium">{format(new Date(tx.createdAt), "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "HH:mm")}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                              <ChevronRight className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium capitalize">{resolveLocalStr(plan.name, i18n.language)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">{tx.amount} {tx.currency}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground uppercase tracking-wide">
                            {resolvePaymentMethod(tx)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <PaymentStatusBadge
                            status={normalizedStatus}
                            label={t(`history.status.${normalizedStatus}`, normalizedStatus)}
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-foreground transition-colors">
                              {shortReference(reference)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => copyTransactionId(tx)}
                              aria-label={t("history.copyTransactionId", "Copy transaction ID")}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs rounded-lg gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors"
                            onClick={() => setSelectedTransaction(tx)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t("history.details", "Details")}</span>
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground">
                          {t("history.empty", "No transactions found matching your filters.")}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {t("history.showingResults", "Showing {{from}} to {{to}} of {{count}} results", {
                from: paginationStart,
                to: paginationEnd,
                count: filteredTransactions.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> {t("history.previous", "Previous")}
              </Button>
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted text-muted-foreground"
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {t("history.next", "Next")} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailsModal
        transaction={selectedTransaction}
        open={Boolean(selectedTransaction)}
        downloadingId={downloadingId}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null);
        }}
        onCopyTransactionId={copyTransactionId}
        onDownloadInvoice={downloadInvoice}
      />
    </div>
  );
}
