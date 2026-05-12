"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { 
  MessageSquare, Gift, TrendingUp, Bot, 
  Monitor, Globe, Smartphone, Calendar,
  MoreVertical, Info
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { useRegion } from "@/components/region-provider";

const COLORS = ["#6d28d9", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

function StatCard({ icon: Icon, label, value, sub, colorClass }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-sm font-medium text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/80 mt-2 flex items-center gap-1.5 font-medium">
        <Info className="w-3 h-3" /> {sub}
      </div>}
    </motion.div>
  );
}

export default function Usage() {
  const { t, i18n } = useTranslation();
  const { region } = useRegion();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isBn = i18n.language === "bn";
  const sym = data?.currencySymbol || (region === "bd" ? "৳" : "$");
  const included = data?.includedMessagesTotal ?? 50;
  const pct = data ? Math.min(100, Math.round((data.messagesUsedThisCycle / included) * 100)) : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] animate-pulse text-muted-foreground font-medium italic">Loading your usage data...</div>;
  }

  const pieData = data?.agentUsage?.filter((a: any) => a.usedMessages > 0).map((a: any) => ({
    name: a.name,
    value: a.usedMessages
  })) || [];

  return (
    <div className="space-y-8 max-w-6xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("sidebar.usage", "Usage Dashboard")}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Monitor your AI message consumption and agent performance.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-xl text-xs font-bold text-muted-foreground shadow-sm">
          <Calendar className="w-4 h-4" />
          {new Date(data?.billingCycleStart).toLocaleDateString(isBn ? "bn-BD" : "en-US", { month: "short", day: "numeric", year: "numeric" })} - Present
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label={isBn ? "মোট AI মেসেজ" : "Total AI Messages"}
          value={data?.ai?.totalMessages ?? 0}
          sub={isBn ? "বর্তমান বিলিং সাইকেলে" : "In current billing cycle"}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Gift}
          label={isBn ? "মেসেজ বাকি" : "Messages Remaining"}
          value={data?.messagesRemaining ?? 0}
          sub={`${isBn ? "মোট কোটা" : "Total quota"}: ${included}`}
          colorClass="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label={isBn ? "পেইড মেসেজ" : "Paid Messages"}
          value={data?.ai?.paidMessages ?? 0}
          sub={data?.ai?.perMessageLabel ? `@ ${data.ai.perMessageLabel} each` : "Standard rate applied"}
          colorClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          icon={Bot}
          label={isBn ? "মোট খরচ" : "Total AI Cost"}
          value={`${sym}${data?.ai?.totalChargedAmount?.toFixed(2) ?? "0.00"}`}
          sub={isBn ? "এই মাসের ট্রানজেকশন" : "Transactions this month"}
          colorClass="bg-fuchsia-500/10 text-fuchsia-600"
        />
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage History Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              {isBn ? "ইউসেজ হিস্ট্রি" : "Usage History"}
            </h3>
            <div className="text-xs text-muted-foreground font-medium">Last 14 Days</div>
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

        {/* Donut Chart */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-bold text-lg mb-8 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-500 rounded-full" />
            {isBn ? "এজেন্ট ভিত্তিক ইউসেজ" : "Usage per agent"}
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
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Messages</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.slice(0, 3).map((item: any, i: number) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="truncate max-w-[100px]">{item.name}</span>
                </div>
                <span className="font-bold">{Math.round((item.value / data.ai.totalMessages) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Table Section */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
          <h3 className="font-bold text-lg">{isBn ? "এজেন্ট পারফরম্যান্স" : "Agent Performance"}</h3>
          <div className="flex gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">Live System</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4">Agent Name</th>
                <th className="px-6 py-4">Max Tokens</th>
                <th className="px-6 py-4">Used Messages</th>
                <th className="px-6 py-4">Status</th>
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
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      agent.status === "active" 
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                      : "bg-red-500/10 text-red-600 border-red-500/20"
                    }`}>
                      {agent.status.toUpperCase()}
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

      {/* Plan Progress Bar */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">{isBn ? "মেসেজ কোটা প্রগ্রেস" : "Plan Message Quota"}</div>
          <div className="text-sm font-bold">
            {data?.messagesUsedThisCycle ?? 0} <span className="text-muted-foreground font-medium text-xs">/ {included}</span>
          </div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-4 shadow-inner">
          <motion.div
            className={`h-full rounded-full shadow-sm ${
              pct >= 90
                ? "bg-gradient-to-r from-red-500 to-orange-500"
                : "bg-gradient-to-r from-primary to-violet-500"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2 italic">
            <span className={`w-2 h-2 rounded-full ${pct >= 90 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            {data?.messagesRemaining} {isBn ? "টি মেসেজ বাকি" : "messages left"}
          </div>
          <div>{pct}% {isBn ? "ব্যবহৃত" : "consumed"}</div>
        </div>
      </div>
    </div>
  );
}

