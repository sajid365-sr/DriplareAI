"use client";

import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

/**
 * Simple search input for filtering connected channel cards
 * by account name, platform, or bot name.
 */
export function SearchBar({ value, onChange }: SearchBarProps) {
    const { t } = useTranslation("integrations");

    return (
        <div className="bg-card border border-border/70 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[280px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
                type="text"
                placeholder={t("searchPlaceholder", "Search channels by name or handle...")}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
        </div>
    );
}
