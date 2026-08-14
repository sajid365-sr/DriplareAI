"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Gift, Globe, ChevronRight } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "./BrandLogo";
import { NotificationBell } from "./NotificationBell";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { BotSwitcher } from "@/components/dashboard/BotSwitcher";

// Maps the last URL segment to a human-readable breadcrumb label
const TAB_LABELS: Record<string, string> = {
  chat: "Playground",
  analytics: "Analytics",
  settings: "Bot Settings",
  integrations: "Integrations",
  sources: "Sources",
  compare: "Compare",
  activity: "Activity",
  edit: "Edit",
  "e-commerce": "E-Commerce",
};

interface DashboardHeaderProps {
  onOpenReferral: () => void;
}

export function DashboardHeader({ onOpenReferral }: DashboardHeaderProps) {
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

  const currentTabLabel = currentTab ? (TAB_LABELS[currentTab] ?? currentTab) : null;

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
      {/* ─── Left side ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Brand Logo */}
        <Link href="/dashboard/overview" className="shrink-0">
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
              subPath={currentTab ?? "chat"}
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
