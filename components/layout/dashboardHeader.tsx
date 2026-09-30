"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Gift, Globe, ChevronRight, Loader2, MessageSquareWarning, Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "./BrandLogo";
import { NotificationBell } from "./NotificationBell";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { BotSwitcher } from "@/components/dashboard/BotSwitcher";

// Maps the last URL segment to the `common`-namespace key that names it.
//
// ⚠️ এখানে **কেবল সত্যিকারের পেজ** থাকবে, রুট-থাকা-মাত্রই নয়। `/chat`,
//    `/compare`, `/activity`, `/sources`, `/integrations` — এগুলো এখন শুধু
//    redirect stub, ওগুলো কখনো render হয় না (redirect সার্ভারেই হয়ে যায়),
//    তাই ওদের label কখনো আঁকা হবে না। `/edit` আর `/e-commerce` রুট দুটোই
//    মোছা হয়েছে — ওদের কাজ Playground, Settings আর Knowledge Base-এ গেছে।
//    তালিকায় না-থাকা সেগমেন্ট নিচে কাঁচা লেখা হিসেবেই দেখানো হয়, তাই নতুন
//    রুট যোগ করলে সেটা চোখে পড়ে — চুপচাপ ইংরেজি থেকে যায় না।
//
// ⚠️ `/playground/compare`-ও এখানে নেই, কারণ `currentTab` **প্রথম** সেগমেন্ট
//    নেয় — অর্থাৎ ওই পেজের breadcrumb "Playground"। ঠিকই আছে: Compare এখন
//    Playground-এর ভেতরের জিনিস, তার সমগোত্রের আলাদা কিছু নয়।
const TAB_LABEL_KEYS: Record<string, string> = {
  setup: "bot.setup",
  playground: "bot.chat",
  analytics: "bot.analytics",
  settings: "bot.settings",
};

interface DashboardHeaderProps {
  onOpenReferral: () => void;
  onOpenFeedback: () => void;
  /** মোবাইলের নেভিগেশন ড্রয়ার খোলে — ডেস্কটপে sidebar সবসময় দৃশ্যমান, তাই কেবল `md:hidden`। */
  onOpenNav: () => void;
  /** True while the pre-dialog screenshot is being taken. */
  feedbackPreparing?: boolean;
  /** Unread admin replies — renders a dot on the feedback button. */
  feedbackUnread?: number;
}

export function DashboardHeader({
  onOpenReferral,
  onOpenFeedback,
  onOpenNav,
  feedbackPreparing = false,
  feedbackUnread = 0,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();

  const chatbotId = params?.chatbotId as string | undefined;
  const isBotPage = !!chatbotId;

  // Derive the current tab from the URL (last segment after chatbotId)
  const currentTab = (() => {
    if (!chatbotId || !pathname) return null;
    // e.g. /dashboard/chatbots/abc123/analytics → "analytics"
    const afterId = pathname.split(chatbotId)[1] ?? "";
    const segment = afterId.replace(/^\//, "").split("/")[0];
    return segment || null;
  })();

  const tabLabelKey = currentTab ? TAB_LABEL_KEYS[currentTab] : null;
  // অজানা সেগমেন্ট হলে কাঁচা সেগমেন্টটাই দেখানো হয় — ফাঁকা breadcrumb-এর চেয়ে
  // ভালো, আর নতুন একটা রুট যোগ করলে সেটা তখনই চোখে পড়ে।
  const currentTabLabel = currentTab
    ? (tabLabelKey ? t(tabLabelKey, currentTab) : currentTab)
    : null;

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
      {/* ─── Left side ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu — দুই sidebar-ই `hidden md:flex`, তাই ফোনে এটাই
            নেভিগেশনের একমাত্র প্রবেশপথ। */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label={t("nav.openMenu", "Open menu")}
          data-testid="mobile-nav-toggle"
          className="md:hidden -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand Logo — ফোনে লুকানো। হেডারে ইতিমধ্যেই বাঁয়ে workspace switcher
            আর ডানে ছয়টা কন্ট্রোল; hamburger যোগ করার পর ৩৭৫px-এ লোগোটাই সেই
            একটা জিনিস যার কোনো কাজ নেই (নেভিগেশন তো ড্রয়ারে, আর লোগোও ওখানেই
            আছে)। লুকিয়ে জায়গা খালি করা হলো, ব্র্যান্ডিং হারায়নি। */}
        <Link href="/dashboard/overview" className="hidden sm:block shrink-0">
          <BrandLogo className="h-8 md:h-9 w-auto hover:opacity-90 transition-opacity" />
        </Link>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Workspace / Business Switcher */}
        <WorkspaceSwitcher />

        {/* ── Bot breadcrumb (bot pages only) ──────────────────────── */}
        {isBotPage && (
          <nav
            aria-label="Breadcrumb"
            className="hidden lg:flex items-center gap-1 text-sm min-w-0"
          >
            {/* Separator after workspace */}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

            {/* "Chatbots" link */}
            <Link
              href="/dashboard/chatbots"
              className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
            >
              {t("sidebar.chatbot", "Chatbots")}
            </Link>

            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

            {/* Bot Switcher — shows current bot name + dropdown */}
            <BotSwitcher
              currentBotId={chatbotId}
              subPath={currentTab ?? "setup"}
            />

            {/* Current tab label */}
            {currentTabLabel && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="text-foreground font-medium whitespace-nowrap truncate max-w-[120px]">
                  {currentTabLabel}
                </span>
              </>
            )}
          </nav>
        )}
      </div>

      {/* ─── Right Side Actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Refer & Earn — desktop */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex h-9 rounded-full border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 gap-1.5 px-3"
          onClick={onOpenReferral}
          data-testid="refer-earn-btn"
        >
          <Gift className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Refer &amp; Earn</span>
        </Button>

        {/* Refer — mobile icon only */}
        <button
          className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/5 transition-colors"
          onClick={onOpenReferral}
        >
          <Gift className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-border mx-0.5" />

        {/* Feedback — desktop */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex h-9 rounded-full border-border hover:bg-muted gap-1.5 px-3 relative"
          onClick={onOpenFeedback}
          disabled={feedbackPreparing}
          data-testid="feedback-btn"
        >
          {feedbackPreparing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MessageSquareWarning className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-medium">
            {t("nav.feedback", "Feedback")}
          </span>
          {feedbackUnread > 0 && !feedbackPreparing && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>

        {/* Feedback — mobile icon only */}
        <button
          type="button"
          className="md:hidden relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={onOpenFeedback}
          disabled={feedbackPreparing}
          aria-label={t("nav.feedback", "Feedback")}
        >
          {feedbackPreparing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MessageSquareWarning className="w-4 h-4" />
          )}
          {feedbackUnread > 0 && !feedbackPreparing && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </button>

        <div className="h-5 w-px bg-border mx-0.5" />

        {/* Notification Bell */}
        <NotificationBell />

        <LanguageToggle />
        <ModeToggle />

        <div className="pl-1">
          <UserButton
            appearance={{ elements: { avatarBox: "w-9 h-9 border-2 border-border hover:border-primary transition-colors" } }}
          >
            {/* "Client Side" shortcut inside the Clerk user button menu */}
            <UserButton.MenuItems>
              <UserButton.Action
                label={t("nav.clientSide", "Client Side")}
                labelIcon={<Globe className="w-4 h-4" />}
                onClick={() => router.push("/")}
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </div>
    </header>
  );
}
