"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Analytics() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => { 
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}/analytics`)
      .then(r => r.json())
      .then(setData); 
  }, [chatbotId]);

  if (!data) return <div className="text-muted-foreground p-8">Loading…</div>;

  const stats = [
    { label: "Total messages", value: data.total_messages },
    { label: "Unique sessions", value: data.unique_sessions },
    { label: "Avg response", value: `${data.avg_response_ms}ms` },
    { label: "Satisfaction", value: `${data.satisfaction}%` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-5 rounded-2xl border border-border bg-card">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-3xl font-bold mt-1">{s.value}</div>
          </motion.div>
        ))}
      </div>
      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="font-semibold mb-4">Last 7 days</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="messages" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
