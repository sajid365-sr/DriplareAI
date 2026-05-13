"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#6d28d9", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export function UsagePerAgent({ data, isBn, pieData }: any) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
      <h3 className="font-bold text-lg mb-8 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-amber-500 rounded-full" />
        {isBn ? "এজেন্ট ভিত্তিক ব্যবহার" : "Usage per agent"}
      </h3>
      <div className="h-[250px] w-full flex flex-col items-center justify-center relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData.length > 0 ? pieData : [{ name: "No data", value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              {pieData.length === 0 && <Cell fill="#f1f5f9" />}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-3xl font-extrabold">{data?.ai?.totalMessages ?? 0}</div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            {isBn ? "মেসেজ" : "Messages"}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {pieData.slice(0, 3).map((item: any, i: number) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="truncate max-w-[100px]">{item.name}</span>
            </div>
            <span className="font-bold">{Math.round((item.value / (data?.ai?.totalMessages || 1)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
