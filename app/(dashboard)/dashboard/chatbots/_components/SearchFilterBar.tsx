"use client";

import { useTranslation } from "react-i18next";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
}

export function SearchFilterBar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
}: SearchFilterBarProps) {
  const { t } = useTranslation("chatbots");

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id="chatbot-search-input"
          type="text"
          placeholder={t("search.placeholder", "Search by bot name...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border h-9 text-sm focus-visible:ring-primary/50"
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 shrink-0">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            id="chatbot-status-filter"
            className="h-9 w-[160px] bg-card border-border text-sm focus:ring-primary/50"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("search.statusAll", "All Statuses")}
            </SelectItem>
            <SelectItem value="active">
              {t("search.statusActive", "Active")}
            </SelectItem>
            <SelectItem value="paused">
              {t("search.statusPaused", "Paused")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
