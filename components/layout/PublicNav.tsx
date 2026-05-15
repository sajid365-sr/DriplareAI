"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sun, Moon, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useUser, UserButton } from "@clerk/nextjs";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "./BrandLogo";
import { useEffect, useState } from "react";
import { ModeToggle } from "../mode-toggle";

export default function PublicNav() {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggle = () => {
    const current = theme === "system" ? resolvedTheme : theme;
    setTheme(current === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-40 h-16 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto h-full flex items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 mr-8" data-testid="public-brand">
          <BrandLogo className="h-9 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition" data-testid="nav-features">{t("nav.features")}</a>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition" data-testid="nav-pricing">{t("nav.pricing")}</Link>
          <Link href="/tutorial" className="text-muted-foreground hover:text-foreground transition" data-testid="nav-tutorial">{t("nav.tutorial")}</Link>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {/* {mounted && (
            <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full h-9 w-9" data-testid="theme-toggle">
              {(theme === "system" ? resolvedTheme : theme) === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )} */}
          <ModeToggle />
          {isSignedIn ? (
            <div className="flex items-center ml-2">
              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Action
                    label="Dashboard"
                    labelIcon={<LayoutDashboard className="w-4 h-4" />}
                    onClick={() => router.push("/dashboard/overview")}
                  />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button variant="ghost" data-testid="signin-btn" className="hidden sm:inline-flex">{t("nav.login")}</Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-primary hover:bg-primary/90 rounded-full text-white" data-testid="cta-btn">{t("nav.cta")}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
