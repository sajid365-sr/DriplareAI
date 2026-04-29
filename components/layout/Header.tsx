"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, Gift, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "./BrandLogo";
import { useEffect, useState } from "react";

export default function Header({ breadcrumb }: { breadcrumb: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggle = () => {
    const current = theme === "system" ? resolvedTheme : theme;
    setTheme(current === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center px-4 md:px-6">
      <Link href="/app/chatbots" className="flex items-center gap-2 mr-4 md:mr-8" data-testid="brand-logo">
        <motion.div whileHover={{ scale: 1.04 }}>
          <BrandLogo className="h-8 md:h-9 w-auto" />
        </motion.div>
      </Link>

      <div className="flex-1 text-sm text-muted-foreground truncate">{breadcrumb}</div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="hidden md:flex h-9 rounded-full bg-secondary/40 border-secondary text-primary hover:bg-secondary" data-testid="refer-earn-btn">
          <Gift className="w-3.5 h-3.5 mr-1.5" /> Refer & Earn
        </Button>

        <LanguageToggle />

        {mounted && (
          <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full h-9 w-9" data-testid="theme-toggle">
            {(theme === "system" ? resolvedTheme : theme) === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative" data-testid="notifications-btn">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        <div className="pl-2">
          <UserButton 
            afterSignOutUrl="/"
            appearance={{ elements: { avatarBox: "w-9 h-9 border-2 border-border hover:border-primary transition-colors" } }}
          />
        </div>
      </div>
    </header>
  );
}
