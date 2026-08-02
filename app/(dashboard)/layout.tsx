"use client";

import { usePathname, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { LimitAlert } from "@/app/(dashboard)/dashboard/_components/limit-alert";

import Sidebar from "@/components/layout/Sidebar";
import FloatingBubbles from "@/components/layout/FloatingBubbles";
import { ReferralPanel } from "@/components/layout/ReferralPanel";
import { DashboardHeader } from "@/components/layout/dashboardHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [botCollapsed, setBotCollapsed] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  const chatbotId = params?.chatbotId as string | undefined;
  const isBotPage = !!chatbotId;
  const isInboxPage = pathname === "/dashboard/inbox" || pathname?.startsWith("/dashboard/inbox");
  const isSubPage = pathname?.startsWith("/dashboard/settings") || pathname?.startsWith("/dashboard/payment") || isInboxPage || isBotPage;

  // Auto-collapse sidebar on sub-pages and Live Inbox to maximize workspace UI
  useEffect(() => {
    if (isSubPage || isInboxPage) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isSubPage, isInboxPage]);

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Dashboard Header (Topbar/Navbar) */}
      <DashboardHeader onOpenReferral={() => setReferralOpen(true)} />

      <LimitAlert />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Container */}
        <div className="relative z-30 shrink-0">
          {/* Main Sidebar (Always present) */}
          <Sidebar
            variant="main"
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            isSubPage={isSubPage}
            leftOffset={0}
          />

          {/* Chatbot Sub-Sidebar (Only on bot pages) */}
          {isBotPage && (
            <Sidebar
              variant="bot"
              chatbotId={chatbotId}
              collapsed={botCollapsed}
              onToggleCollapse={() => setBotCollapsed(!botCollapsed)}
              leftOffset={collapsed ? 72 : 240}
            />
          )}
        </div>

        <main
          className={`flex-1 min-h-0 overflow-auto transition-all duration-300 ${
            isInboxPage ? "p-0" : "p-4 md:p-8"
          } ${isBotPage
              ? (collapsed
                ? (botCollapsed ? "md:ml-[144px]" : "md:ml-[280px]")
                : (botCollapsed ? "md:ml-[312px]" : "md:ml-[448px]"))
              : (collapsed ? "md:ml-[72px]" : "md:ml-60")
            }`}
        >
          <div className={isInboxPage ? "h-full flex flex-col" : "max-w-[1550px] mx-auto"}>
            {children}
          </div>
        </main>
      </div>
      <FloatingBubbles />

      {/* Global Modals */}
      <ConfirmModal />
      <ReferralPanel open={referralOpen} onClose={() => setReferralOpen(false)} />
    </div>
  );
}
