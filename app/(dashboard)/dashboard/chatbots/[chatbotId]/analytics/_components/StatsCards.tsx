"use client";

import { motion } from "framer-motion";
import { MessageSquare, Users, Zap, Smile } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatsCardsProps {
  data: {
    total_messages: number;
    unique_sessions: number;
    avg_response_ms: number;
    satisfaction: number;
  };
}

export const StatsCards = ({ data }: StatsCardsProps) => {
  const { t } = useTranslation("analytics");

  const stats = [
    { 
      label: t("total_messages"), 
      value: data.total_messages, 
      icon: MessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    { 
      label: t("unique_sessions"), 
      value: data.unique_sessions, 
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10"
    },
    { 
      label: t("avg_response"), 
      value: `${data.avg_response_ms}ms`, 
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    { 
      label: t("satisfaction"), 
      value: `${data.satisfaction}%`, 
      icon: Smile,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <h3 className="text-3xl font-bold tracking-tight">{s.value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${s.bg} ${s.color} transition-transform group-hover:scale-110`}>
              <s.icon className="w-5 h-5" />
            </div>
          </div>
          {/* Subtle bottom gradient */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-${s.color.split('-')[1]}-500/20 to-transparent`} />
        </motion.div>
      ))}
    </div>
  );
};
