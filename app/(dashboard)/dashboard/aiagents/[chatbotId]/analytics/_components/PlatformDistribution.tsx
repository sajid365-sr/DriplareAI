"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useTranslation } from "react-i18next";

interface PlatformDistributionProps {
  data: any[];
}

const COLORS = ["#6d28d9", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export const PlatformDistribution = ({ data }: PlatformDistributionProps) => {
  const { t } = useTranslation("analytics");

  // Format data for display (i18n platform names)
  const formattedData = data.map(item => ({
    ...item,
    displayName: t(`platforms.${item.name.toLowerCase()}`, { defaultValue: item.name })
  }));

  if (data.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm h-full flex flex-col items-center justify-center text-muted-foreground italic">
        {t("no_data")}
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm h-full">
      <h3 className="font-semibold text-lg mb-6">{t("platform_distribution")}</h3>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={formattedData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              nameKey="displayName"
            >
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                background: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))", 
                borderRadius: 12 
              }} 
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
