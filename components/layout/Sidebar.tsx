"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bot, Activity, BarChart3, Database, Plug, Settings, GitCompare, Pencil, MessageSquare, ChevronLeft, Gauge, CreditCard, Sparkles, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function Sidebar({ variant = "main", chatbotId, collapsed, onToggleCollapse }: any) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  const mainItems = [
    { to: "/app/chatbots", icon: Bot, label: t("sidebar.chatbot", "AI Agents"), tid: "nav-chatbot" },
    { to: "/app/usage", icon: Gauge, label: t("sidebar.usage", "Usage"), tid: "nav-usage" },
    { to: "/app/settings", icon: Settings, label: t("sidebar.settings", "Settings"), tid: "nav-settings" },
    { to: "/app/payment", icon: CreditCard, label: t("sidebar.payment", "Billing"), tid: "nav-payment" },
  ];

  const botItems = chatbotId ? [
    { to: `/app/chatbots/${chatbotId}/chat`, icon: MessageSquare, label: t("bot.chat", "Chat"), tid: "bot-nav-chat" },
    { to: `/app/chatbots/${chatbotId}/activity`, icon: Activity, label: t("bot.activity", "Activity Logs"), tid: "bot-nav-activity" },
    { to: `/app/chatbots/${chatbotId}/analytics`, icon: BarChart3, label: t("bot.analytics", "Analytics"), tid: "bot-nav-analytics" },
    { to: `/app/chatbots/${chatbotId}/sources`, icon: Database, label: t("bot.sources", "Knowledge Base"), tid: "bot-nav-sources" },
    { to: `/app/chatbots/${chatbotId}/integrations`, icon: Plug, label: t("bot.integrations", "Integrations"), tid: "bot-nav-integrations" },
    { to: `/app/chatbots/${chatbotId}/settings`, icon: Settings, label: t("bot.settings", "Settings"), tid: "bot-nav-settings" },
    { to: `/app/chatbots/${chatbotId}/compare`, icon: GitCompare, label: t("bot.compare", "Compare Models"), tid: "bot-nav-compare" },
    { to: `/app/chatbots/${chatbotId}/edit`, icon: Pencil, label: t("bot.edit", "Edit Code"), tid: "bot-nav-edit" },
  ] : [];

  const items = variant === "bot" ? botItems : mainItems;
  const pointsPct = usage ? Math.min(100, Math.round(((usage.points - usage.points_used) / usage.points) * 100)) : 100;

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card/50 backdrop-blur-sm h-[calc(100vh-64px)] sticky top-16" data-testid={`sidebar-${variant}`}>
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {variant === "bot" ? "Chatbot" : "Workspace"}
        </span>
        <button onClick={onToggleCollapse} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted" data-testid="sidebar-collapse-btn">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {items.map((it, i) => {
          const active = pathname?.startsWith(it.to);
          const Icon = it.icon;
          return (
            <motion.div key={it.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Link
                href={it.to}
                data-testid={it.tid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{it.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="p-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-4" data-testid="points-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> {t("common.points", "Points")}</span>
            <span className="text-xs font-mono text-muted-foreground">{usage ? usage.points - usage.points_used : 0}/{usage?.points ?? 100}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
            <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${pointsPct}%` }} transition={{ duration: 0.8 }} />
          </div>
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-white text-xs h-8"
            onClick={() => router.push("/app/payment")}
            data-testid="upgrade-plan-btn"
          >
            <Rocket className="w-3.5 h-3.5 mr-1" />
            {t("common.upgradeFree", "Upgrade Plan")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
