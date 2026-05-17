"use client";

import { MoreVertical } from "lucide-react";

export function AgentPerformance({ data, t }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-bold text-lg">{t("usage.performance.title", "AI Agent Performance Details")}</h3>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">
            {t("usage.performance.live", "Live System")}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-4">{t("usage.performance.th_name", "AI Agent Name")}</th>
              <th className="px-6 py-4">{t("usage.performance.th_max_tokens", "Max Tokens")}</th>
              <th className="px-6 py-4">{t("usage.performance.th_messages", "Used Messages")}</th>
              <th className="px-6 py-4">{t("usage.performance.th_status", "Status")}</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.agentUsage?.map((agent: any) => (
              <tr key={agent.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold text-xs">
                      {agent.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold">{agent.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-mono text-muted-foreground">{agent.maxTokens.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{agent.usedMessages}</span>
                    <div className="w-16 bg-muted rounded-full h-1 overflow-hidden hidden sm:block">
                      <div
                        className="bg-primary h-full"
                        style={{ width: `${Math.min(100, (agent.usedMessages / (data.ai.totalMessages || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${agent.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-red-500/10 text-red-600 border-red-500/20"
                    }`}>
                    {agent.status === "active" 
                      ? t("usage.performance.status_active", "Active") 
                      : t("usage.performance.status_inactive", "Inactive")}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-all">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
