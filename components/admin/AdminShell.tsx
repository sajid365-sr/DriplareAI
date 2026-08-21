"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <AdminHeader />

      <div className="flex min-h-0 flex-1">
        <div className="relative z-30 shrink-0">
          <AdminSidebar collapsed={collapsed} />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((prev) => !prev)}
            className="absolute -right-3 top-6 z-40 hidden h-7 w-7 rounded-full border border-primary/20 bg-background shadow-md md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <main
          className={`min-h-0 flex-1 overflow-auto p-4 transition-all duration-300 md:p-8 ${
            collapsed ? "md:ml-0" : ""
          }`}
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
