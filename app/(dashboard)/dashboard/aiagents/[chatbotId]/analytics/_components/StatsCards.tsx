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

  // রঙগুলো থিম-টোকেন — আগে `text-blue-500` জাতীয় ক্লাস ছিল, যা AGENTS.md §3
  // ভাঙে এবং dark mode-এ নিজে থেকে হালকা হয় না।
  const stats = [
    {
      label: t("total_messages"),
      value: data.total_messages,
      icon: MessageSquare,
      color: "text-info",
      bg: "bg-info/10"
    },
    {
      label: t("unique_sessions"),
      value: data.unique_sessions,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      label: t("avg_response"),
      value: `${data.avg_response_ms}ms`,
      icon: Zap,
      color: "text-warning",
      bg: "bg-warning/10"
    },
    {
      label: t("satisfaction"),
      value: `${data.satisfaction}%`,
      icon: Smile,
      color: "text-success",
      bg: "bg-success/10"
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
          {/* Subtle bottom accent — স্ট্যাটিক টোকেন, কারণ Tailwind ক্লাস গোড়ায়
              লিখিত থাকতে হয়: আগের `via-${s.color.split('-')[1]}-500/20` কখনো
              generate-ই হতো না, তাই কার্ডের নিচের রেখাটা আসলে অদৃশ্য ছিল। */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </motion.div>
      ))}
    </div>
  );
};
