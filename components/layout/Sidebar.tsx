"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Database,
  Plug,
  Settings,
  ChevronLeft,
  ChevronDown,
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
  Truck,
  Send,
  FileText,
  Activity,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRegion } from "@/components/region-provider";
import { botNavItems } from "./bot-nav";

export default function Sidebar({
  variant = "main",
  chatbotId,
  collapsed,
  onToggleCollapse,
  isSubPage,
  leftOffset = 0,
  mobile = false,
}: any) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { region } = useRegion();
  const [usage, setUsage] = useState<any>(null);

  // Which collapsible groups are open, keyed by group id. A record rather than
  // one boolean per group: there are two such groups now (E-Commerce and
  // Automations) and a third would otherwise mean a third `useState` plus a
  // third branch in the renderer.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    ecom: true,
    automations: true,
  });
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // ড্রয়ারের ভেতরে sidebar কখনো icon-only হয় না — জায়গা যথেষ্ট, আর collapse
  // করার বাটনটাই ওখানে দেখানো হয় না (নিচে)। তাই ডেস্কটপের collapsed state
  // ড্রয়ারে প্রযোজ্য নয়, নইলে sub-পেজে (যেখানে auto-collapse হয়) মোবাইলে
  // হঠাৎ লেখাহীন আইকনের স্তূপ দেখা যেত।
  const effectiveCollapsed = mobile ? false : collapsed;

  // Auto-expand a collapsible sub-menu whenever the user is on one of its
  // child routes — landing on a deep page must never leave the group closed
  // with no visible hint of where you are.
  const isEcomActive =
    pathname?.startsWith("/dashboard/products") ||
    pathname?.startsWith("/dashboard/orders") ||
    pathname?.startsWith("/dashboard/couriers") ||
    pathname?.startsWith("/dashboard/discounts");

  const isAutomationsActive = pathname?.startsWith("/dashboard/automations");

  useEffect(() => {
    if (isEcomActive) setOpenGroups((prev) => ({ ...prev, ecom: true }));
  }, [isEcomActive]);

  useEffect(() => {
    if (isAutomationsActive) setOpenGroups((prev) => ({ ...prev, automations: true }));
  }, [isAutomationsActive]);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => { });
  }, [pathname]);

  // 3-Section Main Navigation Layout (Task 05 Blueprint)
  // Collapsible groups carry `id`, `collapsible: true` and an `isActive` flag —
  // the renderer below is generic over all three, so adding a group is a data
  // change rather than another branch.
  const ecomItems = [
    { to: "/dashboard/products", icon: Package, label: t("sidebar.products", "Products"), tid: "nav-products" },
    { to: "/dashboard/orders", icon: ShoppingBag, label: t("sidebar.orders", "Orders"), tid: "nav-orders" },
    { to: "/dashboard/couriers", icon: Truck, label: t("sidebar.couriers", "Courier Settings"), tid: "nav-couriers" },
    { to: "/dashboard/discounts", icon: Tag, label: t("sidebar.discounts", "Discounts & Coupons"), tid: "nav-discounts" },
  ];

  // Automations used to sit as a single item inside "AI Engine & Automations",
  // which mixed four unrelated jobs — the agent, its knowledge, the channel
  // wiring and the rules. Rules now have their own group, mirroring how
  // RepliBee and Respond.io structure it.
  const automationItems = [
    { to: "/dashboard/automations", icon: Zap, label: t("sidebar.automationRules", "Rules"), tid: "nav-automation-rules", exact: true },
    { to: "/dashboard/automations/broadcasts", icon: Send, label: t("sidebar.automationBroadcasts", "Broadcasts"), tid: "nav-automation-broadcasts" },
    { to: "/dashboard/automations/templates", icon: FileText, label: t("sidebar.automationTemplates", "Templates"), tid: "nav-automation-templates" },
    { to: "/dashboard/automations/activity", icon: Activity, label: t("sidebar.automationActivity", "Activity Log"), tid: "nav-automation-activity" },
  ];

  const mainNavGroups = [
    {
      groupTitle: t("sidebar.groupOperations", "Main Operations"),
      items: [
        { to: "/dashboard/overview", icon: LayoutDashboard, label: t("sidebar.overview", "Overview"), tid: "nav-overview" },
        { to: "/dashboard/inbox", icon: Inbox, label: t("sidebar.inbox", "Live Inbox"), tid: "nav-inbox" },
        { to: "/dashboard/leads", icon: Users, label: t("sidebar.leads", "Leads & Customers"), tid: "nav-leads" },
      ],
    },
    {
      groupTitle: t("sidebar.groupEcom", "E-Commerce Store"),
      id: "ecom",
      collapsible: true,
      isActive: isEcomActive,
      items: ecomItems,
    },
    {
      groupTitle: t("sidebar.groupAutomations", "Automations"),
      id: "automations",
      collapsible: true,
      isActive: isAutomationsActive,
      items: automationItems,
    },
    {
      groupTitle: t("sidebar.groupAI", "AI Engine & Automations"),
      items: [
        { to: "/dashboard/chatbots", icon: Bot, label: t("sidebar.chatbot", "AI Agents"), tid: "nav-chatbot" },
        { to: chatbotId ? `/dashboard/knowledge-base?botId=${chatbotId}` : "/dashboard/knowledge-base", icon: Database, label: t("sidebar.sources", "Knowledge Base"), tid: "nav-sources" },
        { to: "/dashboard/platforms", icon: Plug, label: t("sidebar.platforms", "Platforms"), tid: "nav-platforms" },
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

  // এজেন্টের নেভিগেশন `bot-nav.ts`-এ — মোবাইলের স্ট্রিপও ওখান থেকেই পড়ে, তাই
  // দুটো কখনো আলাদা হয়ে যেতে পারে না (আর Compare ওখানে নেই, কারণ পেজটা এখন
  // Playground-এর ভেতরে)।
  const botItems = chatbotId ? botNavItems(chatbotId) : [];

  const totalCredits = usage?.includedCreditsTotal ?? 500;
  const usedCredits = usage?.creditsUsedThisCycle ?? 0;
  const remaining = Math.max(0, usage?.creditsBalance ?? 0);
  const usagePct = Math.min(100, Math.round((usedCredits / (totalCredits || 1)) * 100));
  const isBn = i18n.language === "bn";

  // Shared renderer for a single nav link (handles collapsed icon-only mode).
  //
  // ড্রয়ারে এটা দ্বিতীয়বার আঁকা হয়, আর ডেস্কটপের sidebar তখনো DOM-এ থাকে
  // (`hidden md:flex` — CSS-এ লুকানো, unmount নয়)। তাই mobile-এ testid-তে
  // `-mobile` বসে, নইলে একই পেজে `nav-overview` দুটো থাকত আর টেস্ট কোনটা
  // ধরবে তা অনুমানের ব্যাপার হয়ে যেত।
  const testIdFor = (tid: string) => (mobile ? `${tid}-mobile` : tid);

  const renderNavItem = (it: any, i: number) => {
    // `exact` exists for items that are a prefix of their siblings — Rules
    // (`/dashboard/automations`) is a prefix of Broadcasts
    // (`/dashboard/automations/broadcasts`), so without it both would light up
    // at once and the sidebar would claim you are in two places.
    const active = it.exact
      ? pathname === it.to
      : pathname === it.to || (it.to !== "/dashboard/overview" && pathname?.startsWith(it.to));
    const Icon = it.icon;
    return (
      <motion.div key={it.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
        <Link
          href={it.to}
          data-testid={testIdFor(it.tid)}
          title={effectiveCollapsed ? it.label : ""}
          className={`flex items-center rounded-lg text-sm font-medium transition-all group ${effectiveCollapsed ? "justify-center px-0 py-2.5 mx-2" : "gap-3 px-3 py-2"
            } ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          <Icon className={`shrink-0 transition-all ${effectiveCollapsed ? "w-5 h-5" : "w-4 h-4"}`} />
          {!effectiveCollapsed && <span className="truncate">{it.label}</span>}
        </Link>
      </motion.div>
    );
  };

  // ডেস্কটপে sidebar নিজেই `fixed top-16` — হেডারের নিচে বসে থাকে। ড্রয়ারের
  // ভেতরে সেটা অর্থহীন: ওখানে পজিশনিং মা-কম্পোনেন্টের (`MobileNavDrawer`),
  // তাই ক্লাসগুলো পুরো আলাদা। তালিকা, আইকন, active-লজিক সব একই থাকে — যা
  // ইচ্ছাকৃত, কারণ দুটো আলাদা করে লিখলেই একদিন দুটো আলাদা হয়ে যেত।
  const shellClass = mobile
    ? "flex h-full w-full flex-col bg-card"
    : `hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm h-[calc(100vh-64px)] fixed top-16 transition-all duration-300 ease-in-out z-30 ${effectiveCollapsed ? "w-[72px]" : variant === "bot" ? "w-52" : "w-60"
      }`;

  return (
    <aside
      className={shellClass}
      style={mobile ? undefined : { left: leftOffset }}
      data-testid={mobile ? `sidebar-${variant}-mobile` : `sidebar-${variant}`}
    >
      {/* Collapse toggle — floated so the nav starts at the very top and the
          first item (Overview) sits level with this arrow instead of below a
          dedicated header row. Drawer-এ এর কোনো মানে নেই, তাই লুকানো। */}
      {!mobile && (
        <button
          onClick={onToggleCollapse}
          className={`absolute z-10 top-2 w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors ${effectiveCollapsed ? "left-1/2 -translate-x-1/2" : "right-3"
            }`}
          data-testid="sidebar-collapse-btn"
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${effectiveCollapsed ? "rotate-180" : ""}`} />
        </button>
      )}

      <nav className={`flex-1 px-3 pb-3 space-y-4 overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${mobile ? "pt-3" : effectiveCollapsed ? "pt-12" : "pt-1.5"
        }`}>
        {variant === "bot" ? (
          <div className="space-y-1">
            {botItems.map((it, i) => {
              const active = pathname?.startsWith(it.to);
              const Icon = it.icon;
              // `bot-nav.ts` কেবল key রাখে, লেখা রাখে না — তালিকা দুই জায়গায়
              // (এখানে আর মোবাইলের স্ট্রিপে) আঁকা হয়, তাই অনুবাদও একবারই হয়।
              const label = t(it.labelKey, it.fallback);
              return (
                <motion.div key={it.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link
                    href={it.to}
                    data-testid={it.tid}
                    title={effectiveCollapsed ? label : ""}
                    className={`flex items-center rounded-lg text-sm font-medium transition-all group ${effectiveCollapsed ? "justify-center px-0 py-2.5 mx-2" : "gap-3 px-3 py-2"
                      } ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    <Icon className={`shrink-0 transition-all ${effectiveCollapsed ? "w-5 h-5" : "w-4 h-4"}`} />
                    {!effectiveCollapsed && <span className="truncate">{label}</span>}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          mainNavGroups.map((group, groupIdx) => {
            // A collapsible group renders as a toggle plus an animated sub-menu.
            // The markup is identical to the E-Commerce branch that used to live
            // here — only the ids changed, so nothing about the existing group's
            // behaviour (auto-expand, testids, collapsed icon mode) moves.
            if (group.collapsible) {
              const isOpen = openGroups[group.id] ?? true;
              return (
                <div key={groupIdx} className="space-y-1">
                  {!effectiveCollapsed ? (
                    <>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        data-testid={testIdFor(`nav-${group.id}-toggle`)}
                        className={`w-full flex items-center justify-between px-3 pt-2 pb-1 group/ecom transition-colors ${group.isActive ? "text-primary" : "text-muted-foreground/70 hover:text-foreground"
                          }`}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider">
                          {group.groupTitle}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key={`${group.id}-submenu`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1">
                              {group.items.map((it, i) => renderNavItem(it, i))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    // Sidebar collapsed → render sub-items as icon-only links.
                    group.items.map((it, i) => renderNavItem(it, i))
                  )}
                </div>
              );
            }

            return (
              <div key={groupIdx} className="space-y-1">
                {!effectiveCollapsed && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">
                      {group.groupTitle}
                    </span>
                  </div>
                )}
                {group.items.map((it, i) => renderNavItem(it, i))}
              </div>
            );
          })
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
                    <span className="text-[9px] uppercase tracking-wider font-bold text-white bg-brand-gradient px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
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
                    className={`h-full rounded-full ${usagePct >= 90 ? "bg-destructive" : "bg-brand-gradient"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>

                <Button
                  size="sm"
                  variant={usage?.plan === "starter" ? "default" : "outline"}
                  className={`w-full text-xs h-7 relative z-10 ${usage?.plan === "starter"
                    ? "bg-brand-gradient hover:opacity-90 text-white border-none"
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
                      className={`${usagePct >= 90 ? "text-destructive" : "text-primary"}`}
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
                    <CreditCard className={`w-3.5 h-3.5 relative z-10 ${usagePct >= 90 ? "text-destructive" : "text-muted-foreground"}`} />
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
