"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Gift } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";

import { BrandLogo } from "./BrandLogo";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  onOpenReferral: () => void;
}

export function DashboardHeader({ onOpenReferral }: DashboardHeaderProps) {
  const pathname = usePathname();
  const params = useParams();
  const { t } = useTranslation();

  const chatbotId = params?.chatbotId as string | undefined;
  const isBotPage = !!chatbotId;

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
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
          onClick={onOpenReferral}
          data-testid="refer-earn-btn"
        >
          <Gift className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Refer & Earn</span>
        </Button>

        {/* Mobile Refer icon only */}
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
          />
        </div>
      </div>
    </header>
  );
}
