"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bot, Plug, MessageSquare } from "lucide-react";

interface MetricsBarProps {
  bots: any[];
  usage: any;
}

export function MetricsBar({ bots, usage }: MetricsBarProps) {
  const { t } = useTranslation("chatbots");

  // Total chatbots count vs plan limit
  const botsCount = bots.length;
  const botsLimit =
    usage?.includedChatbots === Infinity ? "∞" : (usage?.includedChatbots ?? "—");

  // Total connected integrations across all bots
  const activeChannels = bots.reduce(
    (sum, b) => sum + (b.integrations?.length || 0),
    0
  );

  // Monthly conversations from usage API (if available)
  const monthlyConversations: number = usage?.monthlyConversations ?? 0;

  // Plan name for subtext on first card (e.g. "Business Plan")
  const planName: string | null = usage?.plan ?? null;

  const metrics = [
    {
      icon: Bot,
      label: t("metrics.totalChatbots", "Total Chatbots"),
      value: `${botsCount} / ${botsLimit}`,
      subtext: planName ? `${planName} Plan` : null,
      iconClass: "text-violet-500",
      bgClass: "bg-violet-500/10",
    },
    {
      icon: Plug,
      label: t("metrics.activeChannels", "Active Channels"),
      value: activeChannels.toString(),
      subtext: null,
      iconClass: "text-sky-500",
      bgClass: "bg-sky-500/10",
    },
    {
      icon: MessageSquare,
      label: t("metrics.monthlyConversations", "Monthly Conversations"),
      value: `${monthlyConversations.toLocaleString()} ${t("metrics.conversations", "Messages")}`,
      subtext: null,
      iconClass: "text-emerald-500",
      bgClass: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {metrics.map((metric, i) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            {/* Icon */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.bgClass}`}
            >
              <Icon className={`h-4 w-4 ${metric.iconClass}`} />
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {metric.label}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {metric.value}
              </p>
              {metric.subtext && (
                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                  {metric.subtext}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
