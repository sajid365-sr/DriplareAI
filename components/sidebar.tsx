"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Bot, CreditCard, LayoutDashboard, Settings, Menu, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { ModeToggle } from "./mode-toggle";
import { LanguageToggle } from "./language-toggle";

const NAV_ITEMS = [
  { href: "/dashboard/chatbots", icon: LayoutDashboard, label: "dashboard" },
  { href: "/dashboard/usage", icon: Bot, label: "Usage" },
  { href: "/dashboard/billing", icon: CreditCard, label: "pricing" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [pathname, isMobile]);

  const sidebarVariants = {
    open: {
      width: "260px",
      transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
    closed: {
      width: isMobile ? "0px" : "80px",
      transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
  } satisfies Variants;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />
      )}

      <motion.aside
        initial="open"
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className="h-screen bg-card border-r border-border/40 fixed md:sticky top-0 left-0 z-50 flex flex-col overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/40 shrink-0">
          <Link href="/dashboard/chatbots" className={`flex items-center gap-2 text-primary font-bold tracking-tight transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 w-0"}`}>
            <Bot className="w-6 h-6 shrink-0" />
            <span className="truncate whitespace-nowrap">{t("brand")}</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2 scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className={`whitespace-nowrap transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 w-0 hidden md:block"}`}>
                    {t(item.label) || item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-border/40 shrink-0 space-y-4">
          <div className={`flex items-center gap-2 ${!isOpen && "justify-center"}`}>
            <LanguageToggle />
            <ModeToggle />
          </div>
          <div className={`flex items-center gap-3 px-2 ${!isOpen && "justify-center"}`}>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">My Account</p>
                <p className="text-xs text-muted-foreground truncate">Manage profile</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Mobile Toggle Button (when closed) */}
      {isMobile && !isOpen && (
        <Button variant="outline" size="icon" onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg h-12 w-12 bg-primary text-white border-none">
          <Menu className="w-6 h-6" />
        </Button>
      )}
    </>
  );
}
