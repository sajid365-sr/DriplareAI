"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Activity,
  BarChart3,
  Database,
  Plug,
  Settings,
  GitCompare,
  MessageSquare,
  ChevronLeft,
  Gauge,
  CreditCard,
  Rocket,
  LayoutDashboard,
  Inbox,
  ShoppingBag,
  Package,
  Users,
  Zap,
  Tag,
} from "lucide-react";
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

  const effectiveCollapsed = collapsed;

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, [pathname]);

  // 3-Section Main Navigation Layout (Task 05 Blueprint)
  const mainNavGroups = [
    {
      groupTitle: t("sidebar.groupOperations", "Main Operations"),
      items: [
        { to: "/dashboard/overview", icon: LayoutDashboard, label: t("sidebar.overview", "Overview"), tid: "nav-overview" },
        { to: "/dashboard/inbox", icon: Inbox, label: t("sidebar.inbox", "Live Inbox"), tid: "nav-inbox" },
        { to: "/dashboard/orders", icon: ShoppingBag, label: t("sidebar.orders", "Orders"), tid: "nav-orders" },
        { to: "/dashboard/products", icon: Package, label: t("sidebar.products", "Products"), tid: "nav-products" },
        { to: "/dashboard/leads", icon: Users, label: t("sidebar.leads", "Leads & Customers"), tid: "nav-leads" },
      ],
    },
    {
      groupTitle: t("sidebar.groupAI", "AI Engine & Automations"),
      items: [
        { to: "/dashboard/chatbots", icon: Bot, label: t("sidebar.chatbot", "AI Agents"), tid: "nav-chatbot" },
        { to: chatbotId ? `/dashboard/knowledge-base?botId=${chatbotId}` : "/dashboard/knowledge-base", icon: Database, label: t("sidebar.sources", "Knowledge Base"), tid: "nav-sources" },
        { to: "/dashboard/automations", icon: Zap, label: t("sidebar.automations", "Automations"), tid: "nav-automations" },
        { to: "/dashboard/integrations", icon: Plug, label: t("sidebar.integrations", "Integrations"), tid: "nav-integrations" },
      ],
    },
    {
      groupTitle: t("sidebar.groupAccount", "Account & Settings"),
      items: [
        { to: "/dashboard/usage", icon: Gauge, label: t("sidebar.usage", "Usage & Analytics"), tid: "nav-usage" },
        { to: "/dashboard/settings", icon: Settings, label: t("sidebar.settings", "Settings"), tid: "nav-settings" },
        { to: "/dashboard/payment", icon: CreditCard, label: t("sidebar.payment", "Billing"), tid: "nav-payment" },
      ],
    },
  ];

  const botItems = chatbotId
    ? [
        { to: `/dashboard/chatbots/${chatbotId}/analytics`, icon: BarChart3, label: t("bot.analytics", "Overview & Analytics"), tid: "bot-nav-analytics" },
        { to: `/dashboard/chatbots/${chatbotId}/chat`, icon: MessageSquare, label: t("bot.chat", "Playground"), tid: "bot-nav-chat" },
        { to: `/dashboard/chatbots/${chatbotId}/compare`, icon: GitCompare, label: t("bot.compare", "Compare"), tid: "bot-nav-compare" },
        { to: `/dashboard/chatbots/${chatbotId}/settings`, icon: Settings, label: t("bot.settings", "Settings"), tid: "bot-nav-settings" },
      ]
    : [];

  const totalCredits = usage?.includedCreditsTotal ?? 500;
  const usedCredits = usage?.creditsUsedThisCycle ?? 0;
  const remaining = Math.max(0, usage?.creditsBalance ?? 0);
  const usagePct = Math.min(100, Math.round((usedCredits / (totalCredits || 1)) * 100));
  const isBn = i18n.language === "bn";

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm h-[calc(100vh-64px)] fixed top-16 transition-all duration-300 ease-in-out z-30 ${
        effectiveCollapsed ? "w-[72px]" : variant === "bot" ? "w-52" : "w-60"
      }`}
      style={{ left: leftOffset }}
      data-testid={`sidebar-${variant}`}
    >
      {/* Collapse toggle — floated so the nav starts at the very top and the
          first item (Overview) sits level with this arrow instead of below a
          dedicated header row. */}
      <button
        onClick={onToggleCollapse}
        className={`absolute z-10 top-2 w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors ${
          effectiveCollapsed ? "left-1/2 -translate-x-1/2" : "right-3"
        }`}
        data-testid="sidebar-collapse-btn"
      >
        <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${effectiveCollapsed ? "rotate-180" : ""}`} />
      </button>

      <nav className={`flex-1 px-3 pb-3 space-y-4 overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
        effectiveCollapsed ? "pt-12" : "pt-1.5"
      }`}>
        {variant === "bot" ? (
          <div className="space-y-1">
            {botItems.map((it, i) => {
              const active = pathname?.startsWith(it.to);
              const Icon = it.icon;
              return (
                <motion.div key={it.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link
                    href={it.to}
                    data-testid={it.tid}
                    title={effectiveCollapsed ? it.label : ""}
                    className={`flex items-center rounded-lg text-sm font-medium transition-all group ${
                      effectiveCollapsed ? "justify-center px-0 py-2.5 mx-2" : "gap-3 px-3 py-2"
                    } ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <Icon className={`shrink-0 transition-all ${effectiveCollapsed ? "w-5 h-5" : "w-4 h-4"}`} />
                    {!effectiveCollapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          mainNavGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!effectiveCollapsed && (
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">
                    {group.groupTitle}
                  </span>
                </div>
              )}
              {group.items.map((it, i) => {
                const active = pathname === it.to || (it.to !== "/dashboard/overview" && pathname?.startsWith(it.to));
                const Icon = it.icon;
                return (
                  <motion.div key={it.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                    <Link
                      href={it.to}
                      data-testid={it.tid}
                      title={effectiveCollapsed ? it.label : ""}
                      className={`flex items-center rounded-lg text-sm font-medium transition-all group ${
                        effectiveCollapsed ? "justify-center px-0 py-2.5 mx-2" : "gap-3 px-3 py-2"
                      } ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    >
                      <Icon className={`shrink-0 transition-all ${effectiveCollapsed ? "w-5 h-5" : "w-4 h-4"}`} />
                      {!effectiveCollapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </nav>

      {/* Messages / Credit Usage Card */}
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
              <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-3.5 relative overflow-hidden" data-testid="usage-card">
                {usage?.plan && usage.plan !== "starter" && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                )}

                <div className="flex items-center justify-between mb-2 relative z-10">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    {isBn ? "ক্রেডিট" : "Credits"}
                  </span>

                  {!usage?.plan || usage?.plan === "starter" ? (
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                      Starter
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider font-bold text-white bg-gradient-to-r from-primary to-fuchsia-500 px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <Rocket className="w-2.5 h-2.5" />
                      {usage.plan}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mb-1 relative z-10">
                  <span className="text-[11px] font-medium text-muted-foreground">{isBn ? "ব্যবহার" : "Used"}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {usedCredits}/{totalCredits === Infinity ? "∞" : totalCredits}
                  </span>
                </div>

                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2.5 relative z-10">
                  <motion.div
                    className={`h-full rounded-full ${usagePct >= 90 ? "bg-red-500" : "bg-gradient-to-r from-primary to-fuchsia-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>

                <Button
                  size="sm"
                  variant={usage?.plan === "starter" ? "default" : "outline"}
                  className={`w-full text-xs h-7 relative z-10 ${
                    usage?.plan === "starter"
                      ? "bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-white border-none"
                      : "border-primary/20 hover:bg-primary/5"
                  }`}
                  onClick={() => router.push("/dashboard/payment")}
                  data-testid="upgrade-plan-btn"
                >
                  {usage?.plan === "starter" ? (
                    <>
                      <Rocket className="w-3 h-3 mr-1" />
                      {isBn ? "প্ল্যান আপগ্রেড" : "Upgrade Plan"}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-3 h-3 mr-1 text-primary" />
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
                title={usage?.plan ? `${usage.plan} Plan: ${usedCredits}/${totalCredits} credits used` : `Starter: ${usedCredits}/${totalCredits}`}
                className="relative group transition-transform hover:scale-110 active:scale-95"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border shadow-xs">
                  <svg className="absolute w-full h-full -rotate-90 p-1">
                    <circle cx="18" cy="18" r="14" className="text-muted/30" strokeWidth="2.5" fill="transparent" stroke="currentColor" />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r="14"
                      className={`${usagePct >= 90 ? "text-red-500" : "text-primary"}`}
                      strokeWidth="2.5"
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
                    <Rocket className="w-3.5 h-3.5 text-primary relative z-10" />
                  ) : (
                    <CreditCard className={`w-3.5 h-3.5 relative z-10 ${usagePct >= 90 ? "text-red-500" : "text-muted-foreground"}`} />
                  )}
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </aside>
  );
}
