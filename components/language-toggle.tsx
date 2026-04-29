"use client";

import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  
  const set = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("bokbok_lang", lng);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lng;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" data-testid="lang-toggle">
          <Languages className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => set("en")} data-testid="lang-en">English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => set("bn")} data-testid="lang-bn">বাংলা</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
