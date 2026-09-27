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
}

export interface FinancialsSummaryData {
  monthlyRevenueBdt: number;
  totalCostUsd: number;
  totalCostBdt: number;
  netProfitBdt: number;
  netMarginPercent: number;
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
const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string; borderClass: string }
> = {
  product_sync: {
    label: "Social Post Auto-Sync",
    icon: RefreshCw,
    colorClass: "bg-blue-500/10 text-blue-500",
    borderClass: "border-blue-500/20",
  },
  text_ingest: {
    label: "Text/Prompt Context Ingest",
    icon: FileText,
    colorClass: "bg-purple-500/10 text-purple-500",
    borderClass: "border-purple-500/20",
  },
  enhance_prompt: {
    label: "Prompt Enhancer",
    icon: Sparkles,
    colorClass: "bg-indigo-500/10 text-indigo-500",
    borderClass: "border-indigo-500/20",
  },
  quick_setup: {
    label: "Quick Setup Translation",
    icon: Languages,
    colorClass: "bg-cyan-500/10 text-cyan-500",
    borderClass: "border-cyan-500/20",
  },
  playground: {
    label: "Live Chat Playground",
    icon: PlayCircle,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    borderClass: "border-emerald-500/20",
  },
  compare: {
    label: "Model Compare Sandbox",
    icon: GitCompare,
    colorClass: "bg-amber-500/10 text-amber-500",
    borderClass: "border-amber-500/20",
  },
  auto_train: {
    label: "Knowledge Base Auto-Train",
    icon: Database,
    colorClass: "bg-teal-500/10 text-teal-500",
    borderClass: "border-teal-500/20",
  },
  facebook: {
    label: "Facebook Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-sky-500/10 text-sky-500",
    borderClass: "border-sky-500/20",
  },
  whatsapp: {
    label: "WhatsApp Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-green-500/10 text-green-500",
    borderClass: "border-green-500/20",
  },
  instagram: {
    label: "Instagram Inbox AI",
    icon: MessageSquare,
    colorClass: "bg-pink-500/10 text-pink-500",
    borderClass: "border-pink-500/20",
  },
  web: {
    label: "Web Live Chat AI",
    icon: Globe,
    colorClass: "bg-violet-500/10 text-violet-500",
    borderClass: "border-violet-500/20",
  },
};

export function CostAnalyticsTab({
  financials,
  modelBreakdown,
  channelBreakdown,
  usageLogs = [],
}: CostAnalyticsTabProps) {
  const { t } = useTranslation("admin");

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
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              Subscriber Revenue (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-foreground">
              ৳{financials.monthlyRevenueBdt.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Estimated Plan Tier Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-indigo-500" />
              OpenRouter API Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-foreground">
              ৳{financials.totalCostBdt.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ${financials.totalCostUsd} USD actual cost
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Net Profit / Contribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className={cn("text-2xl font-bold", financials.netProfitBdt >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {financials.netProfitBdt >= 0 ? `+৳${financials.netProfitBdt.toLocaleString()}` : `-৳${Math.abs(financials.netProfitBdt).toLocaleString()}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Net margin after LLM API expenses</p>
          </CardContent>
        </Card>

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
              Profit Margin %
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-bold", financials.netMarginPercent >= 50 ? "text-emerald-500" : financials.netMarginPercent >= 0 ? "text-amber-500" : "text-rose-500")}>
                {financials.netMarginPercent}%
              </span>
              {financials.isHighCostAlert && (
                <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                  <AlertTriangle className="h-3 w-3" /> High Risk
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {financials.totalTokens.toLocaleString()} total tokens processed
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
              No channel usage data recorded yet.
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
                        {ch.requestCount} calls
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs">
                      {typeof ch.promptTokens === "number" && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Input / Output Tokens:</span>
                          <span className="font-mono text-foreground">
                            {ch.promptTokens.toLocaleString()} in / {(ch.completionTokens ?? 0).toLocaleString()} out
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Tokens:</span>
                        <span className="font-semibold text-foreground">{ch.totalTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border/30">
                        <span className="text-muted-foreground font-medium">Total Cost:</span>
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
                placeholder="Search model, session..."
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
              <p>No OpenRouter generation logs found matching the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Channel & Context</th>
                    <th className="px-4 py-3">LLM Model</th>
                    <th className="px-4 py-3">Tokens (Input / Output)</th>
                    <th className="px-4 py-3">API Cost (USD)</th>
                    <th className="px-4 py-3">API Cost (BDT)</th>
                    <th className="px-4 py-3 text-right">Credits Deducted</th>
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
                            <span className="text-emerald-500 font-semibold">{log.promptTokens.toLocaleString()} in</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-blue-500 font-semibold">{log.completionTokens.toLocaleString()} out</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">
                            ({log.totalTokens.toLocaleString()} total)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          ${log.costUsd < 0.0001 && log.costUsd > 0 ? log.costUsd.toFixed(6) : log.costUsd.toFixed(5)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground font-mono">
                          ৳{log.costBdt.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.isFreeMessage ? (
                            <Badge variant="secondary" className="text-[10px]">Free</Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[11px] font-semibold">
                              -{log.creditsDeducted} credits
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
              No OpenRouter token logs recorded for this workspace yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-4 py-3">OpenRouter Model</th>
                    <th className="px-4 py-3">Total Calls</th>
                    <th className="px-4 py-3">Prompt Tokens</th>
                    <th className="px-4 py-3">Completion Tokens</th>
                    <th className="px-4 py-3">Total Tokens</th>
                    <th className="px-4 py-3">Cost (USD)</th>
                    <th className="px-4 py-3 text-right">Cost (BDT)</th>
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
                      <td className="px-4 py-3 text-xs text-emerald-500 font-mono font-medium">{m.promptTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-blue-500 font-mono font-medium">{m.completionTokens.toLocaleString()}</td>
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
