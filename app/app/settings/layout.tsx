"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Bell, CreditCard } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const NAV_LINKS = [
    { href: "/app/settings", icon: User, label: "My Profile" },
    { href: "/app/settings/security", icon: Shield, label: "Security and Data" },
    { href: "/app/settings/notifications", icon: Bell, label: "Notification" },
    { href: "/app/settings/billing", icon: CreditCard, label: "Billing History" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
