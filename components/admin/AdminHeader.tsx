"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { UserButton } from "@clerk/nextjs";
import { Shield } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function AdminHeader() {
  const { t } = useTranslation("admin");

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-primary/15 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/admin" className="shrink-0">
          <BrandLogo className="h-8 w-auto opacity-90 transition-opacity hover:opacity-100 md:h-9" />
        </Link>

        <div className="hidden h-6 w-px bg-border sm:block" />

        <div className="hidden items-center gap-2 sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
            <Shield className="h-3.5 w-3.5" />
            {t("header.breadcrumb")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ModeToggle />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-9 w-9 ring-2 ring-primary/20",
            },
          }}
        />
      </div>
    </header>
  );
}
