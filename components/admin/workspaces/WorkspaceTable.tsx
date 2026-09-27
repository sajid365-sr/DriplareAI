"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Bot, ChevronRight, AlertTriangle, ShieldCheck, AlertOctagon, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface WorkspaceRow {
  id: string;
  workspaceId: string;
  name: string;
  logoUrl?: string | null;
  status: "active" | "warning" | "suspended" | string;
  createdAt: string;
  owner: {
    userId: string;
    name: string;
    email: string;
    picture?: string | null;
    plan: string;
    region: string;
    creditsBalance: number;
    creditsUsedThisCycle: number;
  };
  stats: {
    activeChatbots: number;
    totalMessages: number;
    totalTokens: number;
    apiCostUsd: number;
    apiCostBdt: number;
    revenueBdt: number;
    netProfitBdt: number;
    netMarginPercent: number;
    isHighCostAlert: boolean;
  };
}

interface WorkspaceTableProps {
  workspaces: WorkspaceRow[];
  loading?: boolean;
}

export function WorkspaceTable({ workspaces, loading = false }: WorkspaceTableProps) {
  const { t } = useTranslation("admin");

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-primary/10 bg-card/40 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{t("workspaces.table.loading", "Loading workspace analytics...")}</span>
        </div>
      </div>
    );
  }

  if (!workspaces.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-primary/10 bg-card/40 p-8 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-base font-semibold">{t("workspaces.table.emptyTitle", "No Workspaces Found")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("workspaces.table.emptyDesc", "No matching workspace records match your search criteria.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/60 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-primary/10 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-4">{t("workspaces.table.cols.workspace", "Workspace & Owner")}</th>
              <th className="px-4 py-4">{t("workspaces.table.cols.plan", "Plan")}</th>
              <th className="px-4 py-4">{t("workspaces.table.cols.agents", "Agents")}</th>
              <th className="px-4 py-4">{t("workspaces.table.cols.tokensAndCost", "Tokens & API Cost")}</th>
              <th className="px-4 py-4">{t("workspaces.table.cols.margin", "Net Profit Margin")}</th>
              <th className="px-4 py-4">{t("workspaces.table.cols.status", "Status")}</th>
              <th className="px-6 py-4 text-right">{t("workspaces.table.cols.action", "Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {workspaces.map((ws) => {
              const status = ws.status || "active";
              const isHighCost = ws.stats.isHighCostAlert;

              return (
                <tr key={ws.id} className="transition-colors hover:bg-primary/5">
                  {/* Workspace Name & Owner Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/15">
                        <AvatarImage src={ws.logoUrl || ws.owner.picture || undefined} />
                        <AvatarFallback className="bg-brand-gradient text-white text-xs font-bold">
                          {ws.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate max-w-[180px]">
                            {ws.name}
                          </span>
                          {isHighCost && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              High Cost
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{ws.owner.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Plan Badge */}
                  <td className="px-4 py-4">
                    <Badge variant="outline" className="capitalize text-xs font-medium border-primary/20">
                      {ws.owner.plan || "starter"}
                    </Badge>
                  </td>

                  {/* Agents & Channels */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <span>{ws.stats.activeChatbots} Agents</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ws.owner.creditsBalance.toLocaleString()} credits bal
                    </p>
                  </td>

                  {/* Tokens & API Cost */}
                  <td className="px-4 py-4">
                    <div className="font-semibold text-foreground">
                      ৳{ws.stats.apiCostBdt.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {ws.stats.totalTokens.toLocaleString()} tokens (${ws.stats.apiCostUsd})
                    </p>
                  </td>

                  {/* Net Profit Margin Badge */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <Badge
                        className={cn(
                          "w-fit text-[11px] font-semibold",
                          ws.stats.netMarginPercent >= 50
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                            : ws.stats.netMarginPercent >= 0
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-600 border-rose-500/30"
                        )}
                      >
                        {ws.stats.netMarginPercent}% Margin
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {ws.stats.netProfitBdt >= 0 ? `+৳${ws.stats.netProfitBdt}` : `-৳${Math.abs(ws.stats.netProfitBdt)}`}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <Badge
                      className={cn(
                        "capitalize text-[11px] font-medium gap-1",
                        status === "active" && "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
                        status === "warning" && "bg-amber-500/15 text-amber-500 border-amber-500/30",
                        status === "suspended" && "bg-rose-500/15 text-rose-500 border-rose-500/30"
                      )}
                    >
                      {status === "active" && <ShieldCheck className="h-3 w-3" />}
                      {status === "warning" && <AlertTriangle className="h-3 w-3" />}
                      {status === "suspended" && <AlertOctagon className="h-3 w-3" />}
                      {status}
                    </Badge>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <Button asChild size="sm" variant="outline" className="rounded-xl border-primary/20 hover:border-primary/40">
                      <Link href={`/admin/workspaces/${ws.workspaceId || ws.id}`}>
                        <span>{t("workspaces.table.manage", "Manage")}</span>
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
