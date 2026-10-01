"use client";

import { usePathname, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { LimitAlert } from "@/app/(dashboard)/dashboard/_components/limit-alert";
import { WorkspaceProvider } from "@/components/workspace-provider";

import Sidebar from "@/components/layout/Sidebar";
import { BotTabStrip } from "@/components/layout/BotTabStrip";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { ReferralPanel } from "@/components/layout/ReferralPanel";
import { DashboardHeader } from "@/components/layout/dashboardHeader";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { installConsoleCapture } from "@/lib/feedback/console-capture";
import { captureScreenshot, screenshotToFile } from "@/lib/feedback/screenshot";
import { useActiveChatbotId } from "@/hooks/use-live-widget";

// ⚠️ The two imports below deliberately come from the agent section's folder rather
//    than from `components/`. The tester (widget + conversation) used to live in
//    `[chatbotId]/layout.tsx`, i.e. inside the agent section. With the toggle on the
//    widget now floats across the whole dashboard, so ownership moved up here — but
//    the files stay next to their siblings (`chat-preview`, `bot-provider`), otherwise
//    those three would import each other in both directions.
import { TesterProvider } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/_providers/tester-provider";
import { LiveWidget } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/_components/live-widget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [botCollapsed, setBotCollapsed] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  // The mobile navigation drawer. Its state lives here because `Sidebar` is drawn
  // here too — the drawer is just another presentation of that same sidebar.
  //
  // ⚠️ "close it on navigation" is a **calculation** here, not an effect: the state
  //    records *which pathname* the drawer was opened on, and it counts as closed as
  //    soon as that no longer matches the current pathname. Calling
  //    `setNavOpen(false)` inside an effect trips `react-hooks/set-state-in-effect`
  //    (cascading render) — and the thing at stake is not even state, it is the
  //    pathname. So the right behaviour falls out without an effect, and one extra
  //    render is saved.
  //
  // `closeNav` is stable (`[]`) because the drawer's Escape listener keeps it as a
  // dependency; a new function every render would attach and detach the listener
  // over and over.
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

  // The tester's conversation, and its one and only address: the route id on agent
  // pages, and the last opened agent everywhere else (details in `use-live-widget.ts`).
  //
  // ⚠️ This is not `useParams()`, deliberately: this layout sits **above** the
  //    `[chatbotId]` segment, so params can come back empty here.
  const activeChatbotId = useActiveChatbotId();

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
    <TesterProvider chatbotId={activeChatbotId}>
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
            {/* The agent section's navigation, mobile only — on desktop that job
                belongs to `Sidebar variant="bot"`, which is `hidden md:flex`. */}
            {isBotPage && chatbotId && <BotTabStrip chatbotId={chatbotId} />}
            {children}
          </div>
        </main>
      </div>
      {/* The test widget — floats in the corner while the toggle is on; draws nothing
          when it is off.

          ⚠️ The bottom-right corner is now the widget's alone. `FloatingBubbles` (the
             WhatsApp + chat pair) used to sit here too, which is why the widget had to
             step around it — and why that pair had to step around the widget's teaser.
             Three controls competing for one corner. Removed on the user's call: the
             corner gets one clear target. */}
      <LiveWidget />

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
    </TesterProvider>
    </WorkspaceProvider>
  );
}
