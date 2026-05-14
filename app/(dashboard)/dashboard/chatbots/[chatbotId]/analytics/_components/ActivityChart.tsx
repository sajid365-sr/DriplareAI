"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { useTranslation } from "react-i18next";

interface ActivityChartProps {
  data: any[];
}

export const ActivityChart = ({ data }: ActivityChartProps) => {
  const { t } = useTranslation("analytics");

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">{t("last_7_days")}</h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{t("total_messages")}</span>
        </div>
      </div>
      
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip 
              contentStyle={{ 
                background: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))", 
                borderRadius: 12,
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="messages" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorMessages)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
