"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History } from "lucide-react";

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const TABS = [
    { href: "/dashboard/payment", icon: LayoutGrid, label: "Plans & Pricing" },
    { href: "/dashboard/payment/history", icon: History, label: "Billing History" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Billing & Payments
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription plans, payment methods, and billing history.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Horizontal Tabs */}
        <nav className="flex items-center gap-2 p-1 bg-muted/30 rounded-2xl border border-border/50 w-fit">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  isActive 
                    ? "bg-background text-primary shadow-sm border border-border/50" 
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {children}
        </div>
      </div>
    </div>
  );
}
