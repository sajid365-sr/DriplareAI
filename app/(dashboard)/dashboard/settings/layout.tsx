"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Share2, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation("settings");

  const NAV_LINKS = [
    { href: "/dashboard/settings", icon: User, label: t("tabs.profile", "My Profile") },
    { href: "/dashboard/settings/security", icon: Shield, label: t("tabs.security", "Security and Data") },
    { href: "/dashboard/settings/referrals", icon: Share2, label: t("tabs.referrals", "Referrals") },
    { href: "/dashboard/settings/notifications", icon: Bell, label: t("tabs.notifications", "Notification") },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          {t("title", "Settings")}
        </h1>
        <p className="text-muted-foreground">
          {t("subtitle", "Manage your account preferences, security, and notification settings.")}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Vertical Sub-Sidebar */}
        <aside className="w-full md:w-52 shrink-0 sticky top-24">
          <nav className="flex flex-col gap-1.5 p-1 bg-muted/30 rounded-2xl border border-border/50">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    isActive 
                      ? "bg-background text-primary shadow-sm border border-border/50" 
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${isActive ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Optional Helper Text */}
          <div className="mt-6 px-4 py-4 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/10">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("helpNote", "Need help with your account?")} <br/>
              <Link href="/support" className="text-primary hover:underline font-medium">{t("contactSupport", "Contact Support")}</Link>
            </p>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 w-full animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
          {children}
        </div>
      </div>
    </div>
  );
}
