"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  DollarSign,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Layers,
  Activity,
  Filter,
  Search,
  RefreshCw,
  FileText,
  Sparkles,
  Languages,
  PlayCircle,
  GitCompare,
  Database,
  MessageSquare,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatLatency } from "@/lib/domain/observability";
import type { RevenueBasis } from "@/lib/domain/plan-revenue";
import { type WorkspaceDetailData } from "./WorkspaceOverviewTab";
import { cn } from "@/lib/utils";

export interface ModelBreakdownItem {
  modelId: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  requestCount: number;
}

export interface ChannelBreakdownItem {
  channel: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  requestCount: number;
}

export interface AIUsageLogItem {
  id: string;
  userId: string;
  workspaceId?: string | null;
  chatbotId?: string | null;
  sessionId?: string | null;
  channel: string;
  /**
   * What the model was being used *for* (`chat`, `embedding`, `enhance_prompt`…).
   *
   * `null` on every row written from outside the app gateway — which today means
   * every real customer reply, because n8n's billing callback does not send it.
   * Rows written before the column existed put the task name in `channel`
   * instead, which is why the UI resolves the label from `task ?? channel`.
   */
  task?: string | null;
  model: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  creditsDeducted: number;
  isFreeMessage: boolean;
  /**
   * Round-trip time of the app-side AI call, in milliseconds.
   *
   * `null` means **not measured**, not "instant": only calls made through
   * `lib/ai/gateway.ts` are timed, and customer replies bypass it entirely. The
   * table renders `null` as "—" for exactly that reason.
   */
  latencyMs?: number | null;
  /** The model tried first when a fallback happened. `null` = first model succeeded. */
  fallbackFrom?: string | null;
  createdAt: string;
}

export interface FinancialsSummaryData {
  monthlyRevenueBdt: number;
  /** `plan` (a real price) | `custom` (negotiated) | `unknown` (not in catalogue). */
  revenueBasis: RevenueBasis;
  totalCostUsd: number;
  totalCostBdt: number;
  /** `null` when the plan's price cannot be read — see `lib/domain/unit-economics.ts`. */
  netProfitBdt: number | null;
  /** `null` when there is no revenue to divide by, or revenue is unknown. */
  netMarginPercent: number | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  isHighCostAlert: boolean;
}

interface CostAnalyticsTabProps {
  data: WorkspaceDetailData;
  financials: FinancialsSummaryData;
  modelBreakdown: ModelBreakdownItem[];
  channelBreakdown: ChannelBreakdownItem[];
  usageLogs?: AIUsageLogItem[];
}

// Channel display mapping helper
//
// ── Why three colours and not eleven ─────────────────────────────────────────
// This map used to give every channel its own Tailwind palette hue — eleven
// hardcoded colours, which broke dark mode (a palette class has no dark value)
// and, past the eighth, reused hues that become indistinguishable under
// colour-vision deficiency.
//
// Colour here now marks the **kind of caller**, in three classes, drawn from the
// first three validated `chart-*` slots:
//
//   chart-1  a customer talking to the bot (Facebook, WhatsApp, Instagram, web)
//   chart-2  the merchant working on their own agent (playground, prompt tools)
//   chart-3  background work on the knowledge base
//
// Three is the ceiling on purpose: with hue alone as the differentiator, only the
// first three slots survive every pairing in both themes. Identity is carried by
// the icon and the label regardless — the hue only groups, it never encodes.
const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string; borderClass: string }
> = {
  // ── A customer is waiting on the other end ──
  facebook: {
    label: "Facebook Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-chart-1/10 text-chart-1",
    borderClass: "border-chart-1/20",
  },
  whatsapp: {
    label: "WhatsApp Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-chart-1/10 text-chart-1",
    borderClass: "border-chart-1/20",
  },
  instagram: {
    label: "Instagram Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-chart-1/10 text-chart-1",
    borderClass: "border-chart-1/20",
  },
  web: {
    label: "Web Live Chat AI",
    icon: Globe,
    colorClass: "bg-chart-1/10 text-chart-1",
    borderClass: "border-chart-1/20",
  },

  // ── The merchant, building or testing their agent ──
  playground: {
    label: "Live Chat Playground",
    icon: PlayCircle,
    colorClass: "bg-chart-2/10 text-chart-2",
    borderClass: "border-chart-2/20",
  },
  enhance_prompt: {
    label: "Prompt Enhancer",
    icon: Sparkles,
    colorClass: "bg-chart-2/10 text-chart-2",
    borderClass: "border-chart-2/20",
  },
  quick_setup: {
    label: "Quick Setup Translation",
    icon: Languages,
    colorClass: "bg-chart-2/10 text-chart-2",
    borderClass: "border-chart-2/20",
  },
  compare: {
    label: "Model Compare Sandbox",
    icon: GitCompare,
    colorClass: "bg-chart-2/10 text-chart-2",
    borderClass: "border-chart-2/20",
  },

  // ── Nothing is waiting; the knowledge base is being built ──
  text_ingest: {
    label: "Text/Prompt Context Ingest",
    icon: FileText,
    colorClass: "bg-chart-3/10 text-chart-3",
    borderClass: "border-chart-3/20",
  },
  auto_train: {
    label: "Knowledge Base Auto-Train",
    icon: Database,
    colorClass: "bg-chart-3/10 text-chart-3",
    borderClass: "border-chart-3/20",
  },
  product_sync: {
    label: "Social Post Auto-Sync",
    icon: RefreshCw,
    colorClass: "bg-chart-3/10 text-chart-3",
    borderClass: "border-chart-3/20",
  },
};

/**
 * What to say under the revenue figure, per kind of pricing.
 *
 * The three cases look identical as numbers — all three render either a price or
 * a dash — so the sentence beneath is the only thing telling an operator whether
 * they are looking at a real list price, a negotiated deal, or a gap in our data.
 */
const REVENUE_BASIS_HINT: Record<RevenueBasis, { key: string; fallback: string }> = {
  plan: {
    key: "workspaces.analytics.revenueFromPlan",
    fallback: "This workspace's monthly plan price",
  },
  custom: {
    key: "workspaces.analytics.revenueCustom",
    fallback: "Negotiated pricing — there is no list price to read",
  },
  unknown: {
    key: "workspaces.analytics.revenueUnknown",
    fallback: "Plan key is not in this region's catalogue",
  },
};

/** Colours for the margin card, on theme tokens rather than palette classes. */
function marginTone(marginPercent: number | null): { text: string; icon: string } {
  if (marginPercent === null) return { text: "text-muted-foreground", icon: "text-muted-foreground" };
  if (marginPercent >= 50) return { text: "text-success", icon: "text-success" };
  if (marginPercent >= 0) return { text: "text-warning", icon: "text-warning" };
  return { text: "text-destructive", icon: "text-destructive" };
}

export function CostAnalyticsTab({
  financials,
  modelBreakdown,
  channelBreakdown,
  usageLogs = [],
}: CostAnalyticsTabProps) {
  const { t } = useTranslation("admin");

  // A revenue figure only exists when the plan has a price we can read. See
  // `lib/domain/unit-economics.ts` for why "custom" and "unknown" have none.
  const revenueIsKnown = financials.revenueBasis === "plan";
  const revenueHint = REVENUE_BASIS_HINT[financials.revenueBasis];

  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Extract unique channels present in the logs
  const availableChannels = useMemo(() => {
    const channels = new Set<string>();
    usageLogs.forEach((log) => {
      if (log.channel) channels.add(log.channel);
    });
    channelBreakdown.forEach((ch) => {
      if (ch.channel) channels.add(ch.channel);
    });
    return Array.from(channels);
  }, [usageLogs, channelBreakdown]);

  // Filter logs by channel & search query
  const filteredLogs = useMemo(() => {
    return usageLogs.filter((log) => {
      const matchChannel = selectedChannel === "all" || log.channel === selectedChannel;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        log.modelId.toLowerCase().includes(query) ||
        (log.model && log.model.toLowerCase().includes(query)) ||
        (log.sessionId && log.sessionId.toLowerCase().includes(query)) ||
        log.channel.toLowerCase().includes(query);

      return matchChannel && matchSearch;
    });
  }, [usageLogs, selectedChannel, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Financial Unit Economics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className={cn("h-3.5 w-3.5", revenueIsKnown ? "text-success" : "text-muted-foreground")} />
              {t("workspaces.analytics.revenueTitle", "Subscriber Revenue (MRR)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-foreground">
              {revenueIsKnown ? `৳${financials.monthlyRevenueBdt.toLocaleString()}` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t(revenueHint.key, revenueHint.fallback)}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-info" />
              {t("workspaces.analytics.apiCostTitle", "OpenRouter API Cost")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-foreground">
              ৳{financials.totalCostBdt.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("workspaces.analytics.apiCostSub", "${{usd}} USD metered", {
                usd: financials.totalCostUsd,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp
                className={cn(
                  "h-3.5 w-3.5",
                  financials.netProfitBdt === null
                    ? "text-muted-foreground"
                    : financials.netProfitBdt >= 0
                      ? "text-success"
                      : "text-destructive"
                )}
              />
              {t("workspaces.analytics.netProfitTitle", "Net Profit / Contribution")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {financials.netProfitBdt === null ? (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            ) : (
              <p
                className={cn(
                  "text-2xl font-bold",
                  financials.netProfitBdt >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {financials.netProfitBdt >= 0
                  ? `+৳${financials.netProfitBdt.toLocaleString()}`
                  : `-৳${Math.abs(financials.netProfitBdt).toLocaleString()}`}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {financials.netProfitBdt === null
                ? t("workspaces.analytics.profitUnmeasurable", "No plan price to subtract the cost from")
                : t("workspaces.analytics.profitSub", "Revenue minus LLM API spend")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className={cn("h-3.5 w-3.5", marginTone(financials.netMarginPercent).icon)} />
              {t("workspaces.analytics.marginTitle", "Profit Margin %")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-bold", marginTone(financials.netMarginPercent).text)}>
                {financials.netMarginPercent === null ? "—" : `${financials.netMarginPercent}%`}
              </span>
              {financials.isHighCostAlert && (
                <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                  <AlertTriangle className="h-3 w-3" /> {t("workspaces.analytics.highRisk", "High Risk")}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {financials.netMarginPercent === null
                ? t("workspaces.analytics.marginUnmeasurable", "Not measurable for this plan")
                : t("workspaces.analytics.marginSub", "{{tokens}} total tokens processed", {
                    tokens: financials.totalTokens.toLocaleString(),
                  })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel-by-Channel Usage Distribution */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {t("workspaces.analytics.channelTitle", "Channel-by-Channel Usage & Cost Distribution")} ({channelBreakdown.length})
          </CardTitle>
          <CardDescription>
            {t("workspaces.analytics.channelDesc", "Granular token consumption across all platform feature channels")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!channelBreakdown.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("workspaces.analytics.channelEmpty", "No channel usage data recorded yet.")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {channelBreakdown.map((ch) => {
                const config = CHANNEL_CONFIG[ch.channel] || {
                  label: ch.channel.replace(/_/g, " "),
                  icon: Layers,
                  colorClass: "bg-muted/40 text-foreground",
                  borderClass: "border-border/40",
                };
                const IconComponent = config.icon;

                return (
                  <div
                    key={ch.channel}
                    className={cn(
                      "rounded-xl border p-4 transition-all duration-200 hover:shadow-md bg-background/50",
                      config.borderClass
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("p-1.5 rounded-lg shrink-0", config.colorClass)}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-xs capitalize truncate text-foreground">
                          {config.label}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                        {ch.requestCount} {t("workspaces.analytics.callsSuffix", "calls")}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs">
                      {typeof ch.promptTokens === "number" && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t("workspaces.analytics.ioTokens", "Input / Output Tokens:")}</span>
                          <span className="font-mono text-foreground">
                            {ch.promptTokens.toLocaleString()} in / {(ch.completionTokens ?? 0).toLocaleString()} out
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("workspaces.analytics.totalTokens", "Total Tokens:")}</span>
                        <span className="font-semibold text-foreground">{ch.totalTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border/30">
                        <span className="text-muted-foreground font-medium">{t("workspaces.analytics.totalCost", "Total Cost:")}</span>
                        <span className="font-bold text-primary">
                          ৳{ch.costBdt.toFixed(2)} <span className="text-[10px] text-muted-foreground font-mono">(${ch.costUsd.toFixed(4)})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live OpenRouter Generations Log */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {t("workspaces.analytics.liveLogTitle", "Live OpenRouter Generations Log")} ({filteredLogs.length})
            </CardTitle>
            <CardDescription>
              {t("workspaces.analytics.liveLogDesc", "Real-time token consumption, OpenRouter cost & merchant credit deductions")}
            </CardDescription>
          </div>

          {/* Interactive Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("workspaces.analytics.searchPlaceholder", "Search model, session…")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-background/50 border-primary/10"
              />
            </div>

            {availableChannels.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <Badge
                  variant={selectedChannel === "all" ? "default" : "outline"}
                  className="cursor-pointer text-[10px] h-7 px-2.5 whitespace-nowrap"
                  onClick={() => setSelectedChannel("all")}
                >
                  All ({usageLogs.length})
                </Badge>
                {availableChannels.map((ch) => {
                  const cfg = CHANNEL_CONFIG[ch];
                  const label = cfg ? cfg.label : ch;
                  const isSelected = selectedChannel === ch;

                  return (
                    <Badge
                      key={ch}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-[10px] h-7 px-2.5 whitespace-nowrap capitalize transition-all",
                        !isSelected && cfg?.colorClass
                      )}
                      onClick={() => setSelectedChannel(ch)}
                    >
                      {label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!filteredLogs.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Filter className="h-8 w-8 text-muted-foreground/40" />
              <p>{t("workspaces.analytics.logEmpty", "No OpenRouter generation logs found matching the selected filter.")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-4 py-3">{t("workspaces.analytics.colDateTime", "Date & Time")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colChannelContext", "Channel & Context")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colModel", "LLM Model")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colTokens", "Tokens (Input / Output)")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colLatency", "Latency")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colFallback", "Fallback")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colCostUsd", "API Cost (USD)")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.colCostBdt", "API Cost (BDT)")}</th>
                    <th className="px-4 py-3 text-right">{t("workspaces.analytics.colCredits", "Credits Deducted")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredLogs.map((log) => {
                    const formattedDate = new Date(log.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const cfg = CHANNEL_CONFIG[log.channel];
                    const channelLabel = cfg ? cfg.label : log.channel;

                    return (
                      <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {formattedDate}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize text-[10px] font-semibold",
                                cfg ? cfg.colorClass : "bg-muted/40"
                              )}
                            >
                              {channelLabel}
                            </Badge>
                            {log.sessionId && (
                              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                                #{log.sessionId.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground text-xs">{log.model || log.modelId}</span>
                          <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">{log.modelId}</p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-mono text-xs">
                            <span className="text-success font-semibold">{log.promptTokens.toLocaleString()} in</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-info font-semibold">{log.completionTokens.toLocaleString()} out</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">
                            ({log.totalTokens.toLocaleString()} total)
                          </span>
                        </td>
                        {/*
                          ⚠️ "—" is not a placeholder for a small number. Only calls
                          made through `lib/ai/gateway.ts` are timed, and customer
                          replies reach n8n directly, so `null` here means the call
                          was never measured — printing 0 would claim it was instant.
                        */}
                        <td className="px-4 py-3 text-xs font-mono">
                          {formatLatency(log.latencyMs) ? (
                            <span className="font-semibold text-foreground">{formatLatency(log.latencyMs)}</span>
                          ) : (
                            <span
                              className="text-muted-foreground"
                              title={t(
                                "workspaces.analytics.latencyNotMeasured",
                                "Not measured — this call did not go through the app gateway"
                              )}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.fallbackFrom ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant="outline"
                                className="w-fit text-[10px] font-semibold bg-warning/10 text-warning border-warning/30"
                              >
                                {t("workspaces.analytics.fellBack", "Fell back")}
                              </Badge>
                              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                                {log.fallbackFrom}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="text-muted-foreground"
                              title={t(
                                "workspaces.analytics.noFallbackMeasured",
                                "No fallback recorded — either the first model answered or the call was not made through the app gateway"
                              )}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          ${log.costUsd < 0.0001 && log.costUsd > 0 ? log.costUsd.toFixed(6) : log.costUsd.toFixed(5)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground font-mono">
                          ৳{log.costBdt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.isFreeMessage ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {t("workspaces.analytics.freeOffer", "Free")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="bg-destructive/10 text-destructive border-destructive/20 text-[11px] font-semibold"
                            >
                              -{log.creditsDeducted} {t("workspaces.analytics.creditsSuffix", "credits")}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model-by-Model Consumption Table */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            {t("workspaces.analytics.modelTitle", "Model-by-Model Token Consumption & Costs")} ({modelBreakdown.length})
          </CardTitle>
          <CardDescription>{t("workspaces.analytics.modelDesc", "Granular breakdown of API costs by LLM provider model")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!modelBreakdown.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("workspaces.analytics.modelEmpty", "No OpenRouter token logs recorded for this workspace yet.")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColModel", "OpenRouter Model")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColCalls", "Total Calls")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColPrompt", "Prompt Tokens")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColCompletion", "Completion Tokens")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColTotal", "Total Tokens")}</th>
                    <th className="px-4 py-3">{t("workspaces.analytics.modelColCostUsd", "Cost (USD)")}</th>
                    <th className="px-4 py-3 text-right">{t("workspaces.analytics.modelColCostBdt", "Cost (BDT)")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {modelBreakdown.map((m) => (
                    <tr key={m.modelId} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{m.modelName}</span>
                        <p className="text-[11px] font-mono text-muted-foreground">{m.modelId}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{m.requestCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-success font-mono font-medium">{m.promptTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-info font-mono font-medium">{m.completionTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-bold text-foreground font-mono">{m.totalTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">${m.costUsd}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground font-mono">৳{m.costBdt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
