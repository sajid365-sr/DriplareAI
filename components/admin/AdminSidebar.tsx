"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Bot,
  BrainCircuit,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  Plug,
  Share2,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  fallback: string;
};

type NavGroup = {
  titleKey: string;
  fallback: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "sidebar.groupContent",
    fallback: "Content",
    items: [
      { href: "/admin", icon: LayoutDashboard, labelKey: "sidebar.dashboard", fallback: "Dashboard" },
      { href: "/admin/blog", icon: FileText, labelKey: "sidebar.blog", fallback: "Blog" },
      { href: "/admin/contacts", icon: Mail, labelKey: "sidebar.contacts", fallback: "Contacts" },
    ],
  },
  {
    titleKey: "sidebar.groupPlatform",
    fallback: "Platform",
    items: [
      { href: "/admin/workspaces", icon: Building2, labelKey: "sidebar.workspaces", fallback: "Workspaces" },
      { href: "/admin/users", icon: Users, labelKey: "sidebar.users", fallback: "Users" },
      { href: "/admin/bots", icon: Bot, labelKey: "sidebar.bots", fallback: "Bot Governance" },
      { href: "/admin/ai-settings", icon: BrainCircuit, labelKey: "sidebar.aiSettings", fallback: "AI & Credit Rules" },
      { href: "/admin/system", icon: Activity, labelKey: "sidebar.systemHealth", fallback: "System Health" },
      { href: "/admin/platforms", icon: Plug, labelKey: "sidebar.platforms", fallback: "Platforms" },
      { href: "/admin/referrals", icon: Share2, labelKey: "sidebar.referrals", fallback: "Referrals" },
      { href: "/admin/billing", icon: CreditCard, labelKey: "sidebar.billing", fallback: "Billing & Transactions" },
    ],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
}

export function AdminSidebar({ collapsed = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation("admin");

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-primary/15 bg-card/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      {/* Brand accent strip — uses theme primary (~#895AF6) */}
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-gradient" aria-hidden />

      {/* Portal branding */}
      <div className={cn("border-b border-primary/10 px-4 py-5", collapsed && "px-3")}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <Shield className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-foreground">
                {t("portal.title")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {t("portal.subtitle")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {t(group.titleKey, group.fallback)}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? t(item.labelKey, item.fallback) : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-nav-active"
                          className="absolute inset-0 rounded-xl bg-primary/10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon className={cn("relative h-4 w-4 shrink-0", active && "text-primary")} />
                      {!collapsed && (
                        <span className="relative truncate">{t(item.labelKey, item.fallback)}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Back to merchant dashboard */}
      <div className="border-t border-primary/10 p-3">
        <Link
          href="/dashboard/overview"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("sidebar.backToApp")}</span>}
        </Link>
      </div>
    </aside>
  );
}
