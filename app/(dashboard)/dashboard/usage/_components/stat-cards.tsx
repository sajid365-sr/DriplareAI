"use client";

import { motion } from "framer-motion";
import { MessageSquare, Gift, TrendingUp, Bot, Info } from "lucide-react";
import { resolveLocalStr } from "@/lib/plan-config";

interface StatCardProps {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
}

function StatCard({ icon: Icon, label, value, sub, colorClass }: StatCardProps) {
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
      {sub && (
        <div className="text-[11px] text-muted-foreground/80 mt-2 flex items-center gap-1.5 font-medium">
          <Info className="w-3 h-3" /> {sub}
        </div>
      )}
    </motion.div>
  );
}

export function StatCards({ data, isBn, i18n, sym, included }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={MessageSquare}
        label={isBn ? "মোট AI মেসেজ" : "Total AI Messages"}
        value={data?.ai?.totalMessages ?? 0}
        sub={isBn ? "নির্বাচিত সময়ে" : "In selected period"}
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
        sub={data?.ai?.perMessageLabel ? `@ ${resolveLocalStr(data.ai.perMessageLabel, i18n.language)} each` : "Standard rate applied"}
        colorClass="bg-amber-500/10 text-amber-600"
      />
      <StatCard
        icon={Bot}
        label={isBn ? "মোট খরচ" : "Total AI Cost"}
        value={`${sym}${data?.ai?.totalChargedAmount?.toFixed(2) ?? "0.00"}`}
        sub={isBn ? "নির্বাচিত সময়ের খরচ" : "Cost in selected period"}
        colorClass="bg-fuchsia-500/10 text-fuchsia-600"
      />
    </div>
  );
}
