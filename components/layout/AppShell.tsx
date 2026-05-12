"use client";

import { usePathname, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import FloatingBubbles from "./FloatingBubbles";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Gift } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "./BrandLogo";
import { ReferralPanel } from "./ReferralPanel";
import { NotificationBell } from "./NotificationBell";
import { ConfirmModal } from "@/components/modals/confirm-modal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const { t } = useTranslation();
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
      {/* Premium Top Bar */}
      <div className="sticky top-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          {/* Brand Logo */}
          <Link href="/dashboard/overview" className="shrink-0">
            <BrandLogo className="h-8 md:h-9 w-auto hover:opacity-90 transition-opacity" />
          </Link>

          <div className="h-6 w-px bg-border hidden sm:block mx-1" />

          {/* Breadcrumb or Back Button */}
          {isBotPage ? (
            <div className="text-sm font-medium capitalize hidden sm:flex items-center gap-2">
              <span className="text-muted-foreground">{t("sidebar.chatbot", "Chatbot")}</span>
              <span className="text-muted-foreground/50">/</span>
              <span>{pathname?.split("/").pop()}</span>
            </div>
          ) : (
            <Link href="/">
              <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Client Area
              </Button>
            </Link>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Refer & Earn */}
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex h-9 rounded-full border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 gap-1.5 px-3"
            onClick={() => setReferralOpen(true)}
            data-testid="refer-earn-btn"
          >
            <Gift className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Refer & Earn</span>
          </Button>

          {/* Mobile Refer icon only */}
          <button
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/5 transition-colors"
            onClick={() => setReferralOpen(true)}
          >
            <Gift className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-border mx-0.5" />

          {/* Notification Bell */}
          <NotificationBell />

          <LanguageToggle />
          <ModeToggle />

          <div className="pl-1">
            <UserButton
              afterSignOutUrl="/"
              appearance={{ elements: { avatarBox: "w-9 h-9 border-2 border-border hover:border-primary transition-colors" } }}
            />
          </div>
        </div>
      </div>

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
          className={`flex-1 min-h-[calc(100vh-64px)] p-4 md:p-8 transition-all duration-300 ${
            isBotPage 
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
