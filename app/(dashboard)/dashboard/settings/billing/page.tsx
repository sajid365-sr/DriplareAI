"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CreditCard, 
  Calendar, 
  DollarSign,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { resolveLocalStr, getPlan, type PlanKey } from "@/lib/plan-config";
import { useRegion } from "@/components/region-provider";

interface Transaction {
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
}

export default function BillingHistoryPage() {
  const { t, i18n } = useTranslation();
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/payments/history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTransactions(data);
        } else {
          toast.error("Failed to load billing history");
        }
      })
      .catch(() => toast.error("An error occurred"))
      .finally(() => setLoading(false));
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch = tx.sessionId.toLowerCase().includes(search.toLowerCase()) || 
                            tx.packageId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const stats = useMemo(() => {
    const completed = transactions.filter(t => t.status === "completed");
    const totalSpent = completed.reduce((sum, t) => sum + t.amount, 0);
    const lastPayment = completed.length > 0 ? completed[0] : null;
    return {
      totalSpent,
      count: completed.length,
      lastPayment
    };
  }, [transactions]);

  const downloadCSV = () => {
    const headers = ["Date", "Transaction ID", "Package", "Amount", "Currency", "Gateway", "Status"];
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm"),
      tx.sessionId,
      tx.packageId,
      tx.amount,
      tx.currency,
      tx.gateway,
      tx.status
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
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text("Billing History Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(new Date(), "PPP p")}`, 14, 30);
    doc.text(`Platform: Driplare AI`, 14, 35);

    // Summary section
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text("Summary", 14, 48);
    doc.setFontSize(10);
    doc.text(`Total Successful Payments: ${stats.count}`, 14, 55);
    doc.text(`Total Amount Spent: ${stats.totalSpent} ${transactions[0]?.currency || ""}`, 14, 60);
    
    // Table
    const tableHeaders = [["Date", "Reference", "Plan", "Amount", "Gateway", "Status"]];
    const tableData = filteredTransactions.map(tx => [
      format(new Date(tx.createdAt), "MMM d, yyyy"),
      tx.sessionId.slice(-8).toUpperCase(),
      tx.packageId.split("_")[0].toUpperCase(),
      `${tx.amount} ${tx.currency}`,
      tx.gateway.toUpperCase(),
      tx.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 70,
      head: tableHeaders,
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [109, 40, 217] }, // Primary color
      margin: { top: 70 },
    });

    doc.save(`billing_history_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading your billing history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">
                {stats.totalSpent.toLocaleString()} {transactions[0]?.currency || ""}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Payment</p>
              <p className="text-lg font-bold">
                {stats.lastPayment ? format(new Date(stats.lastPayment.createdAt), "MMM d, yyyy") : "N/A"}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-2xl border border-border/50">
        <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by ID or Package..." 
              className="pl-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="h-10 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={downloadCSV} className="rounded-xl flex-1 md:flex-none">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPDF} className="rounded-xl flex-1 md:flex-none">
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Gateway</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Transaction ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => {
                    const planKey = tx.packageId.split("_")[0] as PlanKey;
                    const plan = getPlan(region, planKey);
                    
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
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {tx.amount} {tx.currency}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground uppercase tracking-wide">
                            {tx.gateway}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={tx.status} />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 group-hover:text-foreground transition-colors">
                            {tx.sessionId.slice(0, 12)}...
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No transactions found matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    failed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    initiated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  }[status] || "bg-muted text-muted-foreground border-border";

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
      {status}
    </span>
  );
}
