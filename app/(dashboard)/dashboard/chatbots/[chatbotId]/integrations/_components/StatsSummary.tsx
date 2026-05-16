"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Globe, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatsSummaryProps {
  activeCount: number;
  availableCount: number;
  comingSoonCount: number;
}

export const StatsSummary = ({ activeCount, availableCount, comingSoonCount }: StatsSummaryProps) => {
  const { t } = useTranslation("chatbots");
  const stats = [
    { 
      label: t("integrations_page.stats.activeChannels"), 
      value: activeCount, 
      icon: CheckCircle2, 
      color: "text-emerald-500", 
      bg: "bg-emerald-500/10",
      description: t("integrations_page.stats.currentlyConnected")
    },
    { 
      label: t("integrations_page.stats.availablePlatforms"), 
      value: availableCount, 
      icon: Globe, 
      color: "text-blue-500", 
      bg: "bg-blue-500/10",
      description: t("integrations_page.stats.readyToConnect")
    },
    { 
      label: t("integrations_page.stats.comingSoon"), 
      value: comingSoonCount, 
      icon: Sparkles, 
      color: "text-amber-500", 
      bg: "bg-amber-500/10",
      description: t("integrations_page.stats.newChannelsSoon")
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative group p-6 rounded-3xl border border-border bg-card/40 backdrop-blur-sm hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden"
        >
          {/* Background Decorative Element */}
          <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${stat.bg} rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 opacity-50`} />
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground tracking-tight">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground tabular-nums tracking-tighter">
                  {stat.value}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest pt-1">
                {stat.description}
              </p>
            </div>
            
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} shadow-inner`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
