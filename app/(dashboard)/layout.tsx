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
  const isSubPage = pathname?.startsWith("/dashboard/settings") || pathname?.startsWith("/dashboard/payment") || isBotPage;

  // Auto-collapse sidebar on sub-pages initially
  useEffect(() => {
    if (isSubPage) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isSubPage]);

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header (Topbar/Navbar) */}
      <DashboardHeader onOpenReferral={() => setReferralOpen(true)} />

      <LimitAlert />

      <div className="flex">
        {/* Sidebar Container */}
        <div className="relative z-30">
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
          className={`flex-1 min-h-[calc(100vh-64px)] p-4 md:p-8 transition-all duration-300 ${isBotPage
              ? (collapsed
                ? (botCollapsed ? "md:ml-[144px]" : "md:ml-[280px]")
                : (botCollapsed ? "md:ml-[312px]" : "md:ml-[448px]"))
              : (collapsed ? "md:ml-[72px]" : "md:ml-60")
            }`}
        >
          <div className="max-w-[1550px] mx-auto">
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
