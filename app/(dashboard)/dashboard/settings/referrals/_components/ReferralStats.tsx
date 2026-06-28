"use client";

import { motion } from "framer-motion";
import { Users, CreditCard, Gift, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ReferralStatsProps {
  stats: {
    totalReferrals: number;
    subscribers: number;
    totalPoints: number;
    monthlyProgress: number;
  };
}

export function ReferralStats({ stats }: ReferralStatsProps) {
  const { t } = useTranslation("settings");

  const cards = [
    {
      label: t("referrals.stats.total", "Total Referrals"),
      value: stats.totalReferrals,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      key: "total",
    },
    {
      label: t("referrals.stats.subscribers", "Paid Subscribers"),
      value: stats.subscribers,
      icon: CreditCard,
      color: "text-green-500",
      bg: "bg-green-500/10",
      key: "subscribers",
    },
    {
      label: t("referrals.stats.points", "Total Bonus Credits"),
      value: stats.totalPoints,
      icon: Gift,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      key: "points",
    },
    {
      label: t("referrals.stats.progress", "Monthly Progress"),
      value: `${stats.monthlyProgress}/5`,
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      key: "progress",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-5 rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-0.5">{card.value}</p>
          </div>
          {card.key === "progress" && (
            <div className="mt-4 w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${(stats.monthlyProgress / 5) * 100}%` }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
