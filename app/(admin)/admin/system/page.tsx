"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Filter,
  Info,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface HealthData {
  n8n: {
    status: "online" | "degraded" | "offline" | "unknown";
    latencyMs: number;
    url: string | null;
    webhookUrl: string | null;
    isTestWebhookPath: boolean;
  };
  database: {
    status: "online" | "offline";
    latencyMs: number;
    provider: string;
  };
  channels: {
    active24h: number;
    total: number;
  };
  webhooks: Array<{
    id: string;
    channel: string;
    provider: string;
    status: "active" | "idle" | "inactive";
    endpoint: string;
    lastActivityAt: string | null;
  }>;
  errorLogs: Array<{
    id: string;
    level: "ERROR" | "WARN" | "INFO";
    service: string;
    message: string;
    affectedTarget: string;
    timestamp: string;
  }>;
  timestamp: string;
}

// ── Presentation helpers ───────────────────────────────────────────────────────

const N8N_STATUS_CLASS: Record<HealthData["n8n"]["status"], string> = {
  online: "border-success/30 bg-success/10 text-success",
  degraded: "border-warning/30 bg-warning/10 text-warning",
  offline: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "border-border bg-muted text-muted-foreground",
};

const CHANNEL_STATUS_CLASS: Record<HealthData["webhooks"][number]["status"], string> = {
  active: "border-success/30 bg-success/10 text-success",
  idle: "border-warning/30 bg-warning/10 text-warning",
  inactive: "border-border bg-muted text-muted-foreground",
};

/**
 * Render "when did this channel last do something" in the active language.
 *
 * The server sends an ISO timestamp and nothing more — wording is built here so
 * it follows the language toggle. Note this is *activity*, not health: a quiet
 * channel is not necessarily a broken one, which is why the panel never claims
 * more than "last activity".
 */
function formatLastActivity(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale.startsWith("bn") ? "bn" : "en", {
    numeric: "auto",
  });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return formatter.format(0, "minute");
  if (diffMs < hour) return formatter.format(-Math.round(diffMs / minute), "minute");
  if (diffMs < day) return formatter.format(-Math.round(diffMs / hour), "hour");
  return formatter.format(-Math.round(diffMs / day), "day");
}


export default function AdminSystemHealthPage() {
  const { t, i18n } = useTranslation("admin");

  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Logs Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  // ── Fetch Health Data ────────────────────────────────────────────────────────
  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/system/health");
      if (!res.ok) throw new Error("Failed to load health data");
      const json = await res.json();
      setData(json);
      if (isManual) {
        toast.success(t("systemHealth.refreshSuccess", "System health metrics updated!"));
      }
    } catch {
      toast.error(t("systemHealth.refreshError", "Could not refresh system health."));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // ── Auto Refresh interval (30 seconds) ──
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  // There used to be a per-channel "Test Ping" button here. It awaited a 500ms
  // timeout and then always reported success with a fixed "24ms" — it contacted
  // nothing. A webhook path cannot be honestly probed without POSTing a message
  // into the live pipeline, so the button is gone rather than faked. The Refresh
  // control above re-runs the real checks.

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("systemHealth.loading", "Checking n8n engine & system health…")}
      </div>
    );
  }

  // Filter logs
  const filteredLogs = data.errorLogs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.affectedTarget.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel =
      levelFilter === "all" || log.level.toLowerCase() === levelFilter.toLowerCase();
    return matchesSearch && matchesLevel;
  });

  // Overall state is derived from the two things we actually measure. There is no
  // uptime percentage here on purpose: we keep no history, so any figure would be
  // invented.
  const databaseDown = data.database.status === "offline";
  const n8nDown = data.n8n.status === "offline";
  const overallDegraded = data.n8n.status === "degraded" || data.n8n.status === "unknown";

  const overall = databaseDown || n8nDown
    ? {
        label: t("systemHealth.status.down", "Down"),
        className: "border-destructive/30 bg-destructive/10 text-destructive",
      }
    : overallDegraded
      ? {
          label: t("systemHealth.status.degraded", "Degraded"),
          className: "border-warning/30 bg-warning/10 text-warning",
        }
      : {
          label: t("systemHealth.status.operational", "Operational"),
          className: "border-success/30 bg-success/10 text-success",
        };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      {/* ── Top Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("systemHealth.title", "n8n Workflow & System Health Monitoring")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("systemHealth.description", "Live status of n8n engine, database latency, messaging webhooks, and system error audit logs.")}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-card border border-primary/10 px-3 py-1.5 rounded-xl shadow-xs">
            <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer font-medium">
              Auto-Refresh (30s)
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>

          <Button
            size="sm"
            className="rounded-xl gap-1.5 bg-brand-gradient text-primary-foreground hover:opacity-90 transition-opacity"
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {t("systemHealth.refresh", "Refresh Health Check")}
          </Button>
        </div>
      </motion.div>

      {/* ── 3 Main Health Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: n8n Engine */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] gap-1 capitalize px-2 py-0.5",
                N8N_STATUS_CLASS[data.n8n.status]
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {data.n8n.status}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">
              {t("systemHealth.n8nEngine", "n8n Workflow Engine")}
            </span>
            <div className="text-2xl font-bold font-mono text-primary mt-0.5">
              {/* "—" rather than a fabricated "Connected": an unreachable n8n has
                  no latency to show, and pretending otherwise hides the outage. */}
              {data.n8n.latencyMs > 0 ? `${data.n8n.latencyMs} ms` : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {data.n8n.url ?? t("systemHealth.notConfigured", "Not configured")}
            </p>
            {data.n8n.isTestWebhookPath && (
              <p className="text-[10px] text-warning mt-1 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                <span>
                  {t(
                    "systemHealth.testWebhookPath",
                    "Webhook URL is a test path (/webhook-test/) — it only responds while the n8n editor is listening."
                  )}
                </span>
              </p>
            )}
          </div>
        </motion.div>

        {/* Card 2: Neon Database */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] gap-1 capitalize px-2 py-0.5",
                data.database.status === "online"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {data.database.status}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">{data.database.provider}</span>
            <div className="text-2xl font-bold font-mono text-primary mt-0.5">
              {data.database.latencyMs > 0 ? `${data.database.latencyMs} ms` : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("systemHealth.querySpeed", "Query speed (SELECT 1)")}
            </p>
          </div>
        </motion.div>

        {/* Card 3: System Uptime & Gateway */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-2xl border border-primary/10 bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] gap-1 px-2 py-0.5", overall.className)}
            >
              <Activity className="h-3 w-3" />
              {overall.label}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">
              {t("systemHealth.channelActivity", "Channels active (24h)")}
            </span>
            <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
              {data.channels.active24h}/{data.channels.total}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("systemHealth.channelHint", "Counted from real session activity")}
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Webhook & Messaging Channel Monitor ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="w-full rounded-2xl border border-primary/10 bg-card p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Messaging Webhook Channels Health</h3>
              <p className="text-xs text-muted-foreground">Monitor real-time n8n message trigger hooks across channels.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {data.webhooks.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{w.channel}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] capitalize px-1.5 py-0",
                    CHANNEL_STATUS_CLASS[w.status]
                  )}
                >
                  {w.status}
                </Badge>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Provider:</span>
                  <span className="font-medium text-foreground">{w.provider}</span>
                </div>
                {/* Activity, not latency. These channels are push-based — we never
                    see the inbound leg, so a per-channel response time cannot be
                    measured and is not claimed. */}
                <div className="flex items-center justify-between">
                  <span>{t("systemHealth.lastActivity", "Last activity")}:</span>
                  <span className="font-medium text-foreground">
                    {w.lastActivityAt
                      ? formatLastActivity(w.lastActivityAt, i18n.language)
                      : t("systemHealth.never", "Never")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Endpoint:</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">{w.endpoint}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── System Error & Audit Logs Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="w-full space-y-4"
      >
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-primary/10 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">System Audit & Error Logs</h3>
              <p className="text-xs text-muted-foreground">Recent system logs, failovers, and warnings.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search logs, targets…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-primary/20"
              />
            </div>
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value ?? "all")}>
              <SelectTrigger className="h-9 w-[110px] rounded-xl text-xs border-primary/20">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Container */}
        <div className="w-full border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-medium">Level</th>
                  <th className="p-3.5 font-medium">Service Name</th>
                  <th className="p-3.5 font-medium">Log Details</th>
                  <th className="p-3.5 font-medium">Affected Target</th>
                  <th className="p-3.5 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* An empty table is a legitimate state now that the invented
                    fallback logs are gone — say so instead of showing nothing. */}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                      {t("systemHealth.noLogs", "No system events recorded.")}
                    </td>
                  </tr>
                )}
                {filteredLogs.map((log) => {
                  const levelBadge = {
                    ERROR: "border-destructive/30 bg-destructive/10 text-destructive",
                    WARN: "border-warning/30 bg-warning/10 text-warning",
                    INFO: "border-primary/30 bg-primary/10 text-primary",
                  }[log.level];

                  const icon = {
                    ERROR: <AlertCircle className="h-3 w-3" />,
                    WARN: <AlertTriangle className="h-3 w-3" />,
                    INFO: <Info className="h-3 w-3" />,
                  }[log.level];

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <Badge variant="outline" className={cn("text-[10px] gap-1 px-1.5 py-0", levelBadge)}>
                          {icon}
                          {log.level}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-medium text-foreground">{log.service}</td>
                      <td className="p-3.5 text-muted-foreground">{log.message}</td>
                      <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{log.affectedTarget}</td>
                      <td className="p-3.5 text-right font-mono text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
