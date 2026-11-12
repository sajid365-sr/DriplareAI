"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthIllustration } from "@/components/auth/auth-illustration";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function AuthShell({
  children,
  showBackLink = true,
}: {
  children: React.ReactNode;
  showBackLink?: boolean;
}) {
  const { t } = useTranslation(["auth", "common"]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-8">
        <Link href="/" aria-label={t("brand", { ns: "common" })}>
          <BrandLogo className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-12">
        <aside className="order-1 lg:order-1">
          <AuthIllustration />
        </aside>
        <section className="order-2 flex w-full justify-center lg:order-2">
          <div className="w-full max-w-md">
            {showBackLink && (
              <Link
                href="/get-started"
                className="mb-5 inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("auth.back")}
              </Link>
            )}
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
