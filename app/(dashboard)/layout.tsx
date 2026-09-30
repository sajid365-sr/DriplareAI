"use client";

import { usePathname, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { LimitAlert } from "@/app/(dashboard)/dashboard/_components/limit-alert";
import { WorkspaceProvider } from "@/components/workspace-provider";

import Sidebar from "@/components/layout/Sidebar";
import FloatingBubbles from "@/components/layout/FloatingBubbles";
import { BotTabStrip } from "@/components/layout/BotTabStrip";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { ReferralPanel } from "@/components/layout/ReferralPanel";
import { DashboardHeader } from "@/components/layout/dashboardHeader";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { installConsoleCapture } from "@/lib/feedback/console-capture";
import { captureScreenshot, screenshotToFile } from "@/lib/feedback/screenshot";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [botCollapsed, setBotCollapsed] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  // মোবাইলের নেভিগেশন ড্রয়ার। state এখানে থাকে কারণ `Sidebar`-ও এখানেই
  // আঁকা হয় — ড্রয়ারটা শুধু ওই একই sidebar-এর আরেকটি উপস্থাপনা।
  //
  // ⚠️ "নেভিগেট করলেই বন্ধ" এখানে effect নয়, **হিসাব**: state-এ ধরা থাকে
  //    *কোন pathname-এ* ড্রয়ারটা খোলা হয়েছিল, আর সেটা এখনকার pathname-এর
  //    সাথে না মিললেই ড্রয়ার বন্ধ। effect-এ `setNavOpen(false)` করলে
  //    `react-hooks/set-state-in-effect` ধরে (cascading render), অথচ ব্যাপারটা
  //    state-এরই নয় — pathname-এর। ফলে effect ছাড়াই ঠিক আচরণ পাওয়া যায়,
  //    আর একটা বাড়তি render-ও বাঁচে।
  //
  // `closeNav` stable (`[]`), কারণ ড্রয়ারের Escape-লিসেনার এটাকে
  // dependency-তে রাখে; প্রতি render-এ নতুন ফাংশন হলে লিসেনার বারবার
  // খুলত-বন্ধ হতো।
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = navOpenOn !== null && navOpenOn === pathname;
  const openNav = useCallback(() => setNavOpenOn(pathname), [pathname]);
  const closeNav = useCallback(() => setNavOpenOn(null), []);

  // Feedback state. The screenshot is captured *before* the dialog opens —
  // capturing afterwards would photograph the dialog itself.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPreparing, setFeedbackPreparing] = useState(false);
  const [feedbackScreenshot, setFeedbackScreenshot] = useState<File | null>(null);
  const [feedbackUnread, setFeedbackUnread] = useState(0);

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

  // Start recording console errors for future bug reports, and pick up the
  // current unread-reply count for the header dot.
  useEffect(() => {
    installConsoleCapture();

    let cancelled = false;
    fetch("/api/feedback")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setFeedbackUnread(data.unreadCount ?? 0);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Captures the page, then opens the dialog. The capture is best-effort and
   * returns `null` on failure, so feedback is never blocked by it.
   */
  const handleOpenFeedback = useCallback(async () => {
    if (feedbackPreparing) return;

    setFeedbackPreparing(true);
    try {
      const shot = await captureScreenshot();
      setFeedbackScreenshot(shot ? screenshotToFile(shot) : null);
    } finally {
      setFeedbackPreparing(false);
      setFeedbackOpen(true);
    }
  }, [feedbackPreparing]);

  return (
    <WorkspaceProvider>
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Dashboard Header (Topbar/Navbar) */}
      <DashboardHeader
        onOpenReferral={() => setReferralOpen(true)}
        onOpenFeedback={handleOpenFeedback}
        onOpenNav={openNav}
        feedbackPreparing={feedbackPreparing}
        feedbackUnread={feedbackUnread}
      />

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
            {/* এজেন্ট-পেজের নেভিগেশন, শুধু মোবাইলে — ডেস্কটপে ওই কাজটা
                `Sidebar variant="bot"` করে, যেটা `hidden md:flex`. */}
            {isBotPage && chatbotId && <BotTabStrip chatbotId={chatbotId} />}
            {children}
          </div>
        </main>
      </div>
      <FloatingBubbles />

      {/* Global Modals */}
      <ConfirmModal />
      <MobileNavDrawer open={navOpen} onClose={closeNav} />
      <ReferralPanel open={referralOpen} onClose={() => setReferralOpen(false)} />
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => {
          setFeedbackOpen(false);
          // Releases the captured screenshot's bytes; a later open takes a fresh one.
          setFeedbackScreenshot(null);
        }}
        autoScreenshot={feedbackScreenshot}
        chatbotId={chatbotId}
        onUnreadChange={setFeedbackUnread}
      />
    </div>
    </WorkspaceProvider>
  );
}
