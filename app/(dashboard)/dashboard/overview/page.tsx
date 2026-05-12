"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Smile, 
  BarChart3, 
  PieChart as PieIcon,
  Sparkles,
  ArrowUpRight,
  Clock,
  Wallet
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const { user } = useUser();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isBn = i18n.language === "bn";

  useEffect(() => {
    fetch("/api/analytics/overview")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading overview...</p>
        </div>
      </div>
    );
  }

  const sentimentData = [
    { name: t("overview.sentimentLabels.happy"), value: data?.sentiment?.happy || 0, color: "#10b981" },
    { name: t("overview.sentimentLabels.neutral"), value: data?.sentiment?.neutral || 0, color: "#f59e0b" },
    { name: t("overview.sentimentLabels.unhappy"), value: data?.sentiment?.unhappy || 0, color: "#ef4444" },
  ];

  const COLORS = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];

  const stats = [
    { 
      label: t("overview.leads"), 
      value: data?.summary?.totalLeads || 0, 
      icon: Users, 
      color: "text-blue-500", 
      bg: "bg-blue-500/10",
      description: isBn ? "নতুন কাস্টমার সংগ্রহ" : "New customers captured"
    },
    { 
      label: t("overview.conversations"), 
      value: data?.summary?.totalSessions || 0, 
      icon: MessageSquare, 
      color: "text-purple-500", 
      bg: "bg-purple-500/10",
      description: isBn ? "মোট আলাপচারিতা সংখ্যা" : "Total chat sessions"
    },
    { 
      label: t("overview.moneySaved"), 
      value: `${isBn ? "৳" : "$"}${data?.summary?.moneySaved || 0}`, 
      icon: Wallet, 
      color: "text-emerald-500", 
      bg: "bg-emerald-500/10",
      description: isBn ? "মানুষের সাপোর্ট খরচ বেঁচেছে" : "Saved in support costs"
    },
    { 
      label: t("overview.hoursSaved"), 
      value: `${data?.summary?.hoursSaved || 0}h`, 
      icon: Clock, 
      color: "text-orange-500", 
      bg: "bg-orange-500/10",
      description: isBn ? "টিমের বেঁচে যাওয়া সময়" : "Total support hours saved"
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("overview.welcome", { name: user?.firstName || (isBn ? "ইউজার" : "User") })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("overview.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full shadow-sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Download Report
          </Button>
          <Button className="rounded-full bg-gradient-to-r from-primary to-fuchsia-600 border-none shadow-lg shadow-primary/20 hover:opacity-90">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insights
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group p-6 rounded-3xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5 relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} rounded-full blur-3xl -mr-8 -mt-8 opacity-50 group-hover:opacity-80 transition-opacity`} />
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className={`p-2.5 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12%
              </div>
            </div>
            
            <div className="relative z-10">
              <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
              <div className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-1.5 uppercase font-semibold">
                {stat.description}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 p-6 rounded-3xl border border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-lg">{t("overview.activity")}</h2>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyActivity || []}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  fontSize={12} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))", 
                    borderRadius: "16px",
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
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Sentiment & ROI Side Card */}
        <div className="space-y-6">
          {/* Sentiment Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-3xl border border-border bg-card/50 backdrop-blur-sm flex flex-col items-center text-center"
          >
            <div className="w-full flex items-center gap-2 mb-6">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Smile className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-lg">{t("overview.sentiment")}</h2>
            </div>
            
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="text-2xl font-bold">88%</div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Positive</div>
              </div>
            </div>

            <div className="w-full grid grid-cols-3 gap-2 mt-4">
              {sentimentData.map((s) => (
                <div key={s.name} className="flex flex-col items-center">
                  <div className="text-xs font-semibold">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.name}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ROI Info Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="p-5 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">ROI Analysis</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t("overview.roiNote")}
                </p>
                <div className="mt-4 flex items-center justify-between bg-background/50 p-3 rounded-2xl">
                  <div className="text-xs font-semibold">Efficiency</div>
                  <div className="text-sm font-bold text-primary">8.5x Higher</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Grid: Platform Breakdown & Top Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Traffic */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-6 rounded-3xl border border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <PieIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-lg">{t("overview.platforms")}</h2>
          </div>
          
          <div className="space-y-4">
            {data?.platforms?.map((p: any, i: number) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 capitalize">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold">{p.count} interactions</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.count / (data?.summary?.totalMessages || 1)) * 100}%` }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Topics */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="p-6 rounded-3xl border border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-lg">{t("overview.topTopics")}</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {data?.topTopics?.map((topic: any, i: number) => (
              <div 
                key={topic.topic}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-transparent hover:border-border hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                    {i + 1}
                  </div>
                  <span className="font-medium text-sm">{topic.topic}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{topic.count} hits</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
