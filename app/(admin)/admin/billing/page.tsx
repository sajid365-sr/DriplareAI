"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  BadgeDollarSign,
  BrainCircuit,
  Coins,
  CreditCard,
  RefreshCw,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualTopupDialog } from "@/components/admin/billing/ManualTopupDialog";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface OverviewData {
  totalRevenue: number;
  mrr: number;
  totalCreditsDistributed: number;
  activePaidSubscriptions: number;
}

interface UserSnippet {
  name: string;
  email: string;
  picture: string | null;
  userId: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  gateway: string;
  paymentStatus: string;
  packageId: string;
  createdAt: string;
  user: UserSnippet;
}

interface CreditRow {
  id: string;
  action_type: string;
  model_tier: string | null;
  credits_spent: number;
  chatbotId: string | null;
  createdAt: string;
  user: UserSnippet;
}

interface AIUsageRow {
  id: string;
  chatbotId: string | null;
  channel: string;
  model: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  creditsDeducted: number;
  isFreeMessage: boolean;
  createdAt: string;
  user: UserSnippet;
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border border-primary/10 bg-card/70 p-5 backdrop-blur-sm shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight truncate">{value}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── User Cell ──────────────────────────────────────────────────────────────────
function UserCell({ user }: { user: UserSnippet }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-primary/15">
        <AvatarImage src={user.picture ?? undefined} alt={user.name} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight text-foreground">{user.name}</p>
        <p className="truncate text-[11px] text-muted-foreground leading-tight">{user.email}</p>
      </div>
    </div>
  );
}

// ─── Payment Status Badge ────────────────────────────────────────────────────────
function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "border-success/30 bg-success/10 text-success",
    paid:      "border-success/30 bg-success/10 text-success",
    pending:   "border-warning/30 bg-warning/10 text-warning",
    failed:    "border-destructive/30 bg-destructive/10 text-destructive",
    initiated: "border-info/30 bg-info/10 text-info",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] capitalize font-medium px-2 py-0.5 rounded-md", map[status.toLowerCase()] ?? "border-border bg-muted/40 text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}

// ─── Pagination Row ──────────────────────────────────────────────────────────────
function PaginationRow({ pagination, onPage }: { pagination: Pagination; onPage: (p: number) => void }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-3">
      <p className="text-[11px] text-muted-foreground">
        {t("billing.pagination.total", { count: pagination.total })}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[60px] text-center text-[11px] text-muted-foreground">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Empty / Loading State ───────────────────────────────────────────────────────
function TableState({ text }: { text: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{text}</div>;
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminBillingPage() {
  const { t } = useTranslation("admin");

  const [overview, setOverview]           = useState<OverviewData | null>(null);
  const [overviewLoading, setOvLoading]   = useState(true);

  const [payments, setPayments]           = useState<PaymentRow[]>([]);
  const [paymentsPage, setPaymentsPage]   = useState(1);
  const [paymentsPag, setPaymentsPag]     = useState<Pagination | null>(null);
  const [paymentsLoading, setPmtLoading]  = useState(false);

  const [credits, setCredits]             = useState<CreditRow[]>([]);
  const [creditsPage, setCreditsPage]     = useState(1);
  const [creditsPag, setCreditsPag]       = useState<Pagination | null>(null);
  const [creditsLoading, setCrLoading]    = useState(false);
  const [creditFilter, setCreditFilter]   = useState("all");

  const [aiLogs, setAiLogs]              = useState<AIUsageRow[]>([]);
  const [aiPage, setAiPage]              = useState(1);
  const [aiPag, setAiPag]               = useState<Pagination | null>(null);
  const [aiLoading, setAiLoading]        = useState(false);

  const [topupOpen, setTopupOpen]        = useState(false);

  // ── Fetchers ─────────────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOvLoading(true);
    try {
      const r = await fetch("/api/admin/billing?type=overview");
      if (!r.ok) throw new Error();
      setOverview(await r.json());
    } catch { toast.error(t("billing.loadError")); }
    finally { setOvLoading(false); }
  }, [t]);

  const fetchPayments = useCallback(async (page: number) => {
    setPmtLoading(true);
    try {
      const r = await fetch(`/api/admin/billing?type=payments&page=${page}&limit=15`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPayments(d.transactions);
      setPaymentsPag(d.pagination);
    } catch { toast.error(t("billing.loadError")); }
    finally { setPmtLoading(false); }
  }, [t]);

  const fetchCredits = useCallback(async (page: number, actionType: string) => {
    setCrLoading(true);
    try {
      const p = new URLSearchParams({ type: "credits", page: String(page), limit: "15" });
      if (actionType !== "all") p.set("actionType", actionType);
      const r = await fetch(`/api/admin/billing?${p}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setCredits(d.credits);
      setCreditsPag(d.pagination);
    } catch { toast.error(t("billing.loadError")); }
    finally { setCrLoading(false); }
  }, [t]);

  const fetchAiLogs = useCallback(async (page: number) => {
    setAiLoading(true);
    try {
      const r = await fetch(`/api/admin/billing?type=ai_usage&page=${page}&limit=15`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setAiLogs(d.logs);
      setAiPag(d.pagination);
    } catch { toast.error(t("billing.loadError")); }
    finally { setAiLoading(false); }
  }, [t]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchPayments(1); }, [fetchPayments]);
  useEffect(() => { fetchCredits(1, "all"); }, [fetchCredits]);
  useEffect(() => { fetchAiLogs(1); }, [fetchAiLogs]);

  const handleRefreshAll = () => {
    fetchOverview();
    fetchPayments(paymentsPage);
    fetchCredits(creditsPage, creditFilter);
    fetchAiLogs(aiPage);
  };

  const handleCreditFilter = (val: string) => {
    setCreditFilter(val);
    setCreditsPage(1);
    fetchCredits(1, val);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full max-w-full">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("billing.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("billing.description")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={handleRefreshAll}
            disabled={overviewLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", overviewLoading && "animate-spin")} />
            {t("billing.refresh")}
          </Button>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 bg-brand-gradient text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={() => setTopupOpen(true)}
          >
            <Coins className="h-3.5 w-3.5" />
            {t("billing.topup.trigger")}
          </Button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BadgeDollarSign} label={t("billing.stats.totalRevenue")}
          value={overviewLoading ? "—" : `৳ ${(overview?.totalRevenue ?? 0).toLocaleString()}`}
          sub={t("billing.stats.allTime")} delay={0} />
        <StatCard icon={TrendingUp} label={t("billing.stats.mrr")}
          value={overviewLoading ? "—" : `৳ ${(overview?.mrr ?? 0).toLocaleString()}`}
          sub={t("billing.stats.last30Days")} delay={0.06} />
        <StatCard icon={Coins} label={t("billing.stats.creditsDistributed")}
          value={overviewLoading ? "—" : (overview?.totalCreditsDistributed ?? 0).toLocaleString()}
          sub={t("billing.stats.allTransactions")} delay={0.12} />
        <StatCard icon={Users} label={t("billing.stats.activePaid")}
          value={overviewLoading ? "—" : (overview?.activePaidSubscriptions ?? 0).toLocaleString()}
          sub={t("billing.stats.paidPlans")} delay={0.18} />
      </div>

      {/* ── Tabs (Stacked Vertically: TabsList on top, TabsContent full width below) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.22 }}
        className="w-full"
      >
        <Tabs defaultValue="payments" className="w-full flex flex-col gap-4">

          {/* Tab navigation bar — horizontal on top */}
          <div className="w-full">
            <TabsList className="inline-flex h-11 items-center justify-start rounded-xl bg-muted/60 p-1 w-full sm:w-auto border border-primary/10">
              <TabsTrigger
                value="payments"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                  data-[selected]:bg-primary data-[selected]:text-primary-foreground
                  data-[active]:bg-primary data-[active]:text-primary-foreground"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {t("billing.tabs.payments")}
              </TabsTrigger>
              <TabsTrigger
                value="credits"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                  data-[selected]:bg-primary data-[selected]:text-primary-foreground
                  data-[active]:bg-primary data-[active]:text-primary-foreground"
              >
                <Coins className="h-3.5 w-3.5" />
                {t("billing.tabs.credits")}
              </TabsTrigger>
              <TabsTrigger
                value="ai_usage"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                  data-[selected]:bg-primary data-[selected]:text-primary-foreground
                  data-[active]:bg-primary data-[active]:text-primary-foreground"
              >
                <BrainCircuit className="h-3.5 w-3.5" />
                {t("billing.tabs.aiUsage")}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Payment History ─── */}
          <TabsContent value="payments" className="w-full mt-0">
            <div className="w-full overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
              {paymentsLoading && !payments.length ? (
                <TableState text={t("billing.loading")} />
              ) : !payments.length ? (
                <TableState text={t("billing.empty")} />
              ) : (
                <>
                  {/* Column headers */}
                  <div className="hidden border-b border-border/50 bg-muted/30 px-5 py-3 md:grid md:grid-cols-5 md:gap-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.user")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.amount")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.gateway")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.status")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.date")}</span>
                  </div>
                  {/* Rows */}
                  <ul className="divide-y divide-border/40">
                    {payments.map((tx) => (
                      <li key={tx.id}
                        className="grid grid-cols-1 gap-y-2 px-5 py-4 transition-colors hover:bg-primary/[0.04] md:grid md:grid-cols-5 md:items-center md:gap-4"
                      >
                        <UserCell user={tx.user} />
                        <span className="text-xs font-semibold text-foreground">
                          {tx.currency.toLowerCase()} {tx.amount.toLocaleString()}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground">{tx.gateway}</span>
                        <div>
                          <PaymentStatusBadge status={tx.paymentStatus} />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {paymentsPag && paymentsPag.totalPages > 1 && (
                    <PaginationRow pagination={paymentsPag} onPage={(p) => { setPaymentsPage(p); fetchPayments(p); }} />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── Credit Allocations ─── */}
          <TabsContent value="credits" className="w-full mt-0">
            <div className="w-full overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
              {/* Filter toolbar */}
              <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">{t("billing.credits.filterLabel")}</p>
                <Select value={creditFilter} onValueChange={handleCreditFilter}>
                  <SelectTrigger className="h-8 w-44 rounded-lg text-xs border-primary/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">{t("billing.credits.filterAll")}</SelectItem>
                    <SelectItem value="admin_topup">admin_topup</SelectItem>
                    <SelectItem value="reply_economy">reply_economy</SelectItem>
                    <SelectItem value="reply_standard">reply_standard</SelectItem>
                    <SelectItem value="reply_premium">reply_premium</SelectItem>
                    <SelectItem value="enhance_prompt">enhance_prompt</SelectItem>
                    <SelectItem value="file_embedding">file_embedding</SelectItem>
                    <SelectItem value="test_chat">test_chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {creditsLoading && !credits.length ? (
                <TableState text={t("billing.loading")} />
              ) : !credits.length ? (
                <TableState text={t("billing.empty")} />
              ) : (
                <>
                  <div className="hidden border-b border-border/50 bg-muted/30 px-5 py-3 md:grid md:grid-cols-5 md:gap-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.user")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.actionType")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.tier")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.credits")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.date")}</span>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {credits.map((cr) => (
                      <li key={cr.id}
                        className="grid grid-cols-1 gap-y-2 px-5 py-4 transition-colors hover:bg-primary/[0.04] md:grid md:grid-cols-5 md:items-center md:gap-4"
                      >
                        <UserCell user={cr.user} />
                        <div>
                          <Badge variant="outline"
                            className={cn("text-[10px] font-medium rounded-md px-2 py-0.5",
                              cr.action_type === "admin_topup"
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-primary/25 bg-primary/8 text-primary")}>
                            {cr.action_type}
                          </Badge>
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">{cr.model_tier ?? "—"}</span>
                        <span className={cn("text-xs font-bold tabular-nums",
                          cr.credits_spent < 0 ? "text-success" : "text-destructive")}>
                          {cr.credits_spent < 0 ? "+" : "−"}{Math.abs(cr.credits_spent)}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(cr.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {creditsPag && creditsPag.totalPages > 1 && (
                    <PaginationRow pagination={creditsPag} onPage={(p) => { setCreditsPage(p); fetchCredits(p, creditFilter); }} />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── AI Usage Logs ─── */}
          <TabsContent value="ai_usage" className="w-full mt-0">
            <div className="w-full overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
              {aiLoading && !aiLogs.length ? (
                <TableState text={t("billing.loading")} />
              ) : !aiLogs.length ? (
                <TableState text={t("billing.empty")} />
              ) : (
                <>
                  <div className="hidden border-b border-border/50 bg-muted/30 px-5 py-3 md:grid md:grid-cols-6 md:gap-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.user")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.model")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.platform")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.tokens")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.costUSD")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{t("billing.table.date")}</span>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {aiLogs.map((log) => (
                      <li key={log.id}
                        className="grid grid-cols-1 gap-y-2 px-5 py-4 transition-colors hover:bg-primary/[0.04] md:grid md:grid-cols-6 md:items-center md:gap-4"
                      >
                        <UserCell user={log.user} />
                        <span className="truncate text-xs text-muted-foreground" title={log.model}>
                          {log.model.length > 25 ? log.model.slice(0, 22) + "…" : log.model}
                        </span>
                        <div>
                          <Badge variant="secondary" className="text-[10px] capitalize rounded-md px-2 py-0.5">{log.channel}</Badge>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{log.totalTokens.toLocaleString()}</span>
                        <span className="text-xs font-medium tabular-nums">
                          {log.isFreeMessage
                            ? <span className="text-success text-[10px] font-semibold">Free</span>
                            : `$${log.costUsd.toFixed(5)}`}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {aiPag && aiPag.totalPages > 1 && (
                    <PaginationRow pagination={aiPag} onPage={(p) => { setAiPage(p); fetchAiLogs(p); }} />
                  )}
                </>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </motion.div>

      {/* ── Manual Top-up Dialog ── */}
      <ManualTopupDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        onSuccess={handleRefreshAll}
      />
    </div>
  );
}
