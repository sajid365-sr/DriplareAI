"use client";

import { useTranslation } from "react-i18next";
import { Cpu, DollarSign, BarChart3, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  requestCount: number;
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
}

export function CostAnalyticsTab({
  financials,
  modelBreakdown,
  channelBreakdown,
}: CostAnalyticsTabProps) {
  const { t } = useTranslation("admin");

  return (
    <div className="space-y-6">
      {/* Financial Unit Economics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profit Margin %
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-bold", financials.netMarginPercent >= 50 ? "text-emerald-500" : financials.netMarginPercent >= 0 ? "text-amber-500" : "text-rose-500")}>
                {financials.netMarginPercent}%
              </span>
              {financials.isHighCostAlert && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  High Risk
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {financials.totalTokens.toLocaleString()} total tokens processed
            </p>
          </CardContent>
        </Card>
      </div>

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
                    <th className="px-4 py-3">Requests</th>
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
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.requestCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.promptTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.completionTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{m.totalTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">${m.costUsd}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">৳{m.costBdt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Breakdown */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {t("workspaces.analytics.channelTitle", "Channel-by-Channel Usage")} ({channelBreakdown.length})
          </CardTitle>
          <CardDescription>{t("workspaces.analytics.channelDesc", "Token distribution across integration platforms")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!channelBreakdown.length ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No channel usage data recorded yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {channelBreakdown.map((ch) => (
                <div key={ch.channel} className="rounded-xl border border-primary/10 bg-background/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm uppercase tracking-wider text-primary">{ch.channel}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {ch.requestCount} requests
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Tokens:</span>
                    <span className="font-semibold">{ch.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Cost:</span>
                    <span className="font-bold text-foreground">৳{ch.costBdt} (${ch.costUsd})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
