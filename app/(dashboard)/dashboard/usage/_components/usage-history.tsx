"use client";

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";

export function UsageHistory({ data, t, rangeType }: any) {
  return (
    <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-2">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          {t("usage.history.title", "Usage History")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="text-[10px] bg-muted px-2.5 py-1 rounded-full font-bold text-muted-foreground border border-border/50">
            {rangeType === "billing" ? t("usage.range.billing", "Current Billing Cycle") : rangeType.toUpperCase()}
          </div>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.dailyUsage}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: "12px" }}
            />
            <Bar
              dataKey="count"
              fill="#6d28d9"
              radius={[6, 6, 0, 0]}
              barSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
