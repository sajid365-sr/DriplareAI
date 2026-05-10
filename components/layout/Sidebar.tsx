"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bot, Activity, BarChart3, Database, Plug, Settings, GitCompare, Pencil, MessageSquare, ChevronLeft, Gauge, CreditCard, Rocket } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRegion } from "@/components/region-provider";

export default function Sidebar({ 
  variant = "main", 
  chatbotId, 
  collapsed, 
  onToggleCollapse,
  isSubPage,
  leftOffset = 0,
}: any) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { region } = useRegion();
  const [usage, setUsage] = useState<any>(null);

  // Use the collapsed state directly
  const effectiveCollapsed = collapsed;

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => { });
  }, [pathname]);

  const mainItems = [
    { to: "/dashboard/chatbots", icon: Bot, label: t("sidebar.chatbot", "AI Agents"), tid: "nav-chatbot" },
    { to: "/dashboard/usage", icon: Gauge, label: t("sidebar.usage", "Usage"), tid: "nav-usage" },
    { to: "/dashboard/settings", icon: Settings, label: t("sidebar.settings", "Settings"), tid: "nav-settings" },
    { to: "/dashboard/payment", icon: CreditCard, label: t("sidebar.payment", "Billing"), tid: "nav-payment" },
  ];

  const botItems = chatbotId ? [
    { to: `/dashboard/chatbots/${chatbotId}/chat`, icon: MessageSquare, label: t("bot.chat", "Chat"), tid: "bot-nav-chat" },
    { to: `/dashboard/chatbots/${chatbotId}/activity`, icon: Activity, label: t("bot.activity", "Activity Logs"), tid: "bot-nav-activity" },
    { to: `/dashboard/chatbots/${chatbotId}/analytics`, icon: BarChart3, label: t("bot.analytics", "Analytics"), tid: "bot-nav-analytics" },
    { to: `/dashboard/chatbots/${chatbotId}/sources`, icon: Database, label: t("bot.sources", "Knowledge Base"), tid: "bot-nav-sources" },
    { to: `/dashboard/chatbots/${chatbotId}/integrations`, icon: Plug, label: t("bot.integrations", "Integrations"), tid: "bot-nav-integrations" },
    { to: `/dashboard/chatbots/${chatbotId}/settings`, icon: Settings, label: t("bot.settings", "Settings"), tid: "bot-nav-settings" },
    { to: `/dashboard/chatbots/${chatbotId}/compare`, icon: GitCompare, label: t("bot.compare", "Compare Models"), tid: "bot-nav-compare" },
    { to: `/dashboard/chatbots/${chatbotId}/edit`, icon: Pencil, label: t("bot.edit", "Edit Code"), tid: "bot-nav-edit" },
  ] : [];

  const items = variant === "bot" ? botItems : mainItems;

  // Message usage calculation
  const included = usage?.includedMessagesTotal ?? 50;
  const used = usage?.messagesUsedThisCycle ?? 0;
  const remaining = Math.max(0, included - used);
  const usagePct = Math.min(100, Math.round((used / included) * 100));

  const isBn = i18n.language === "bn";

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm h-[calc(100vh-64px)] fixed top-16 transition-all duration-300 ease-in-out z-30 ${
        variant === "bot" ? "w-52" : (effectiveCollapsed ? "w-[72px]" : "w-60")
      }`}
      style={{ left: leftOffset }}
      data-testid={`sidebar-${variant}`}
    >
      <div className={`flex items-center px-4 py-4 ${effectiveCollapsed ? "justify-center" : "justify-between"}`}>
        {!effectiveCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold truncate"
          >
            {variant === "bot" ? "Chatbot" : "Workspace"}
          </motion.span>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          data-testid="sidebar-collapse-btn"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${effectiveCollapsed ? "rotate-180" : ""}`} />
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
                title={effectiveCollapsed ? it.label : ""}
                className={`flex items-center rounded-lg text-sm font-medium transition-all group ${effectiveCollapsed ? "justify-center px-0 py-2.5 mx-2" : "gap-3 px-3 py-2.5"
                  } ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon className={`shrink-0 transition-all ${effectiveCollapsed ? "w-5 h-5" : "w-4 h-4"}`} />
                {!effectiveCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="truncate"
                  >
                    {it.label}
                  </motion.span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Messages usage card (replaces old points card) */}
      {/* Messages usage card (replaces old points card) - Only show in main sidebar */}
      {variant === "main" && (
        <AnimatePresence mode="wait">
          {!effectiveCollapsed ? (
          <motion.div
            key="expanded-usage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-3 mt-auto"
          >
            <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-4 relative overflow-hidden" data-testid="usage-card">
              {/* Premium Glow Effect for paid plans */}
              {usage?.plan && usage.plan !== "starter" && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              )}
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  {isBn ? "মেসেজ" : "Messages"}
                </span>
                
                {/* Plan Badge */}
                {(!usage?.plan || usage?.plan === "starter") ? (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                    Starter
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white bg-gradient-to-r from-primary to-fuchsia-500 px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <Rocket className="w-3 h-3" />
                    {usage.plan}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between mb-1.5 relative z-10">
                <span className="text-xs font-medium text-muted-foreground">
                  {isBn ? "ব্যবহার" : "Usage"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {used}/{included}
                </span>
              </div>
              
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3 relative z-10">
                <motion.div
                  className={`h-full rounded-full ${usagePct >= 90
                      ? "bg-red-500"
                      : "bg-gradient-to-r from-primary to-fuchsia-500"
                    }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              
              <Button
                size="sm"
                variant={usage?.plan === "starter" ? "default" : "outline"}
                className={`w-full text-xs h-8 relative z-10 ${
                  usage?.plan === "starter" 
                    ? "bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-white border-none" 
                    : "border-primary/20 hover:bg-primary/5"
                }`}
                onClick={() => router.push("/dashboard/payment")}
                data-testid="upgrade-plan-btn"
              >
                {usage?.plan === "starter" ? (
                  <>
                    <Rocket className="w-3.5 h-3.5 mr-1" />
                    {isBn ? "প্ল্যান আপগ্রেড" : "Upgrade Plan"}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    {isBn ? "সাবস্ক্রিপশন" : "Manage Billing"}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-usage"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="p-3 mt-auto mb-4 flex flex-col items-center gap-4"
          >
            <Link 
              href="/dashboard/payment"
              title={usage?.plan ? `${usage.plan} Plan: ${used}/${included} messages used` : `Starter: ${used}/${included}`}
              className="relative group transition-transform hover:scale-110 active:scale-95"
            >
              {/* Circular Progress SVG */}
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-card border border-border shadow-sm">
                <svg className="absolute w-full h-full -rotate-90 p-1">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    className="text-muted/30"
                    strokeWidth="3"
                    fill="transparent"
                    stroke="currentColor"
                  />
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="16"
                    className={`${usagePct >= 90 ? "text-red-500" : "text-primary"}`}
                    strokeWidth="3"
                    fill="transparent"
                    stroke="currentColor"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={{ strokeDasharray: `${usagePct} 100` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    pathLength="100"
                  />
                </svg>
                
                {usage?.plan && usage.plan !== "starter" ? (
                  <Rocket className="w-4 h-4 text-primary relative z-10" />
                ) : (
                  <MessageSquare className={`w-4 h-4 relative z-10 ${usagePct >= 90 ? "text-red-500" : "text-muted-foreground"}`} />
                )}

                {/* Pulsing indicator for high usage */}
                {usagePct >= 90 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              
              {/* Invisible tooltip area */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-medium">
                {usagePct}% used
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </aside>
  );
}
