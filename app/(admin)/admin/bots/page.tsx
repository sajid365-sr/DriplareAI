"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BotDetailsSheet,
  BotDetails,
} from "@/components/admin/bots/BotDetailsSheet";
import { cn } from "@/lib/utils";

interface MetricsData {
  totalActiveBots: number;
  totalTrainingChunks: number;
  globalChatSessions: number;
  totalBots: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Stat Card Component ────────────────────────────────────────────────────────
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

// ─── Main Admin Bots Page ────────────────────────────────────────────────────────
export default function AdminBotsPage() {
  const { t } = useTranslation("admin");

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [bots, setBots] = useState<BotDetails[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Selected bot for Inspection Drawer
  const [selectedBot, setSelectedBot] = useState<BotDetails | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  // ── Fetch Bots ───────────────────────────────────────────────────────────────
  const fetchBots = useCallback(
    async (p: number, searchVal: string, statusVal: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: "15",
        });
        if (searchVal) params.set("search", searchVal);
        if (statusVal && statusVal !== "all") params.set("status", statusVal);

        const res = await fetch(`/api/admin/bots?${params}`);
        if (!res.ok) throw new Error("Failed to fetch bots");

        const data = await res.json();
        setMetrics(data.metrics);
        setBots(data.bots);
        setPagination(data.pagination);
      } catch {
        toast.error(t("bots.loadError", "Could not load bots data."));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchBots(page, search, statusFilter);
  }, [fetchBots, page, search, statusFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleToggleStatus = async (
    botId: string,
    newStatus: "active" | "disabled" | "suspended"
  ) => {
    try {
      const res = await fetch(`/api/admin/bots/${botId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success(`Bot status updated to ${newStatus}`);
      fetchBots(page, search, statusFilter);

      // If drawer is open with this bot, update selectedBot
      if (selectedBot && selectedBot.id === botId) {
        setSelectedBot((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      toast.error("Could not update bot status.");
    }
  };

  const handleDeleteBot = async (botId: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/bots/${botId}/toggle`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete bot");

      toast.success(`Bot "${name}" deleted.`);
      if (inspectOpen && selectedBot?.id === botId) {
        setInspectOpen(false);
      }
      fetchBots(page, search, statusFilter);
    } catch {
      toast.error("Could not delete bot.");
    }
  };

  const handleInspect = (bot: BotDetails) => {
    setSelectedBot(bot);
    setInspectOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("bots.title", "Merchant & Bot Governance")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("bots.description", "Centralized audit, status control, and analytics across all merchant chatbots.")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => fetchBots(page, search, statusFilter)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t("bots.refresh", "Refresh")}
          </Button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Bot}
          label={t("bots.stats.activeBots", "Total Active Bots")}
          value={loading ? "—" : (metrics?.totalActiveBots ?? 0).toLocaleString()}
          sub={t("bots.stats.activeBotsSub", "Out of {{total}} total bots", { total: metrics?.totalBots ?? 0 })}
          delay={0}
        />
        <StatCard
          icon={Database}
          label={t("bots.stats.trainingChunks", "Total Training Chunks")}
          value={loading ? "—" : (metrics?.totalTrainingChunks ?? 0).toLocaleString()}
          sub={t("bots.stats.chunksSub", "RAG vector database chunks")}
          delay={0.06}
        />
        <StatCard
          icon={MessageSquare}
          label={t("bots.stats.chatSessions", "Global Chat Sessions")}
          value={loading ? "—" : (metrics?.globalChatSessions ?? 0).toLocaleString()}
          sub={t("bots.stats.sessionsSub", "Across all integrations")}
          delay={0.12}
        />
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="w-full space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("bots.searchPlaceholder", "Search by bot name, owner email, or workspace…")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs rounded-xl border-primary/15"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-40 rounded-xl text-xs border-primary/15">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{t("bots.filterAll", "All Statuses")}</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── DataTable ── */}
        <div className="w-full overflow-hidden rounded-xl border border-primary/10 bg-card shadow-sm">
          {loading && !bots.length ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t("bots.loading", "Loading bots data…")}
            </div>
          ) : !bots.length ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t("bots.empty", "No chatbots found.")}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="hidden border-b border-border/50 bg-muted/30 px-5 py-3 md:grid md:grid-cols-7 md:gap-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 col-span-2">
                  {t("bots.table.botName", "Bot Name & Model")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t("bots.table.workspace", "Workspace")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t("bots.table.merchant", "Merchant Owner")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t("bots.table.stats", "Sources / Sessions")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {t("bots.table.status", "Status")}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 text-right">
                  {t("bots.table.actions", "Actions")}
                </span>
              </div>

              {/* Rows */}
              <ul className="divide-y divide-border/40">
                {bots.map((bot) => {
                  const statusClass = {
                    active: "border-success/30 bg-success/10 text-success",
                    disabled: "border-warning/30 bg-warning/10 text-warning",
                    suspended: "border-destructive/30 bg-destructive/10 text-destructive",
                  }[bot.status] ?? "border-border bg-muted/40 text-muted-foreground";

                  return (
                    <li
                      key={bot.id}
                      className="grid grid-cols-1 gap-y-2 px-5 py-4 transition-colors hover:bg-primary/[0.04] md:grid md:grid-cols-7 md:items-center md:gap-4"
                    >
                      {/* Bot Info */}
                      <div className="flex items-center gap-3 col-span-2 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0 ring-1 ring-primary/20">
                          {bot.avatarBase64 ? (
                            <AvatarImage src={bot.avatarBase64} alt={bot.name} />
                          ) : null}
                          <AvatarFallback
                            className="text-white text-xs font-bold"
                            style={{ backgroundColor: bot.avatarColor || "#895AF6" }}
                          >
                            {bot.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {bot.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {bot.model} ({bot.provider})
                          </p>
                        </div>
                      </div>

                      {/* Workspace */}
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-muted-foreground truncate block">
                          {bot.workspace?.name ?? "Default Workspace"}
                        </span>
                      </div>

                      {/* Merchant */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0 ring-1 ring-primary/10">
                          <AvatarImage src={bot.user.picture ?? undefined} alt={bot.user.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {bot.user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{bot.user.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{bot.user.email}</p>
                        </div>
                      </div>

                      {/* Sources / Sessions */}
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{bot.sourcesCount}</span> sources /{" "}
                        <span className="font-semibold text-foreground">{bot.sessionsCount}</span> sessions
                      </div>

                      {/* Status Badge */}
                      <div>
                        <Badge variant="outline" className={cn("text-[10px] capitalize font-medium px-2 py-0.5 rounded-md", statusClass)}>
                          {bot.status}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 rounded-lg text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleInspect(bot)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            {bot.status !== "active" && (
                              <DropdownMenuItem
                                className="text-xs gap-2 text-success"
                                onClick={() => handleToggleStatus(bot.id, "active")}
                              >
                                <PlayCircle className="h-3.5 w-3.5" /> Enable Bot
                              </DropdownMenuItem>
                            )}
                            {bot.status !== "disabled" && (
                              <DropdownMenuItem
                                className="text-xs gap-2 text-warning"
                                onClick={() => handleToggleStatus(bot.id, "disabled")}
                              >
                                <PauseCircle className="h-3.5 w-3.5" /> Disable Bot
                              </DropdownMenuItem>
                            )}
                            {bot.status !== "suspended" && (
                              <DropdownMenuItem
                                className="text-xs gap-2 text-destructive"
                                onClick={() => handleToggleStatus(bot.id, "suspended")}
                              >
                                <ShieldAlert className="h-3.5 w-3.5" /> Suspend Bot
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs gap-2 text-destructive"
                              onClick={() => handleDeleteBot(bot.id, bot.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete Bot
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-3">
                  <p className="text-[11px] text-muted-foreground">
                    {t("bots.pagination.total", { count: pagination.total, defaultValue: `${pagination.total} total bots` })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-[60px] text-center text-[11px] text-muted-foreground">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage(pagination.page + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Inspect Drawer Sheet */}
      <BotDetailsSheet
        open={inspectOpen}
        onOpenChange={setInspectOpen}
        bot={selectedBot}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
}
