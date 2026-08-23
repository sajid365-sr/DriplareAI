"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse sidebar on AI Settings and heavy-data admin pages (like Live Inbox / Chatbots in dashboard)
  const isAutoCollapsePage = pathname === "/admin/ai-settings" || pathname?.startsWith("/admin/ai-settings");

  useEffect(() => {
    if (isAutoCollapsePage) {
      setCollapsed(true);
    }
  }, [pathname, isAutoCollapsePage]);

  useEffect(() => {
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");

    const handleCollapse = (e: Event) => {
      const customEv = e as CustomEvent<boolean>;
      setCollapsed(customEv.detail);
    };

    window.addEventListener("driplare:collapse-sidebar", handleCollapse);

    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("driplare:collapse-sidebar", handleCollapse);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AdminHeader />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Inline Desktop Sidebar - Hidden on viewports < 1024px (lg) */}
        <div className="relative z-30 hidden shrink-0 lg:flex">
          <AdminSidebar collapsed={collapsed} />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((prev) => !prev)}
            className="absolute -right-3 top-6 z-40 hidden h-7 w-7 rounded-full border border-primary/20 bg-background shadow-md lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Main Content Area - Full width on mobile/tablet, overflow-x-hidden */}
        <main className="min-h-0 flex-1 overflow-y-auto w-full px-4 py-6 md:p-8 overflow-x-hidden">
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
