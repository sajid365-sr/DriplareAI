"use client";

import { Brain, Coins, Filter, Search, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelCatalogToolbarProps {
  totalItems: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  providerFilter: string;
  onProviderFilterChange: (provider: string) => void;
  uniqueProviders: string[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  creditFilter: string;
  onCreditFilterChange: (credit: string) => void;
}

export function ModelCatalogToolbar({
  totalItems,
  searchQuery,
  onSearchChange,
  providerFilter,
  onProviderFilterChange,
  uniqueProviders,
  statusFilter,
  onStatusFilterChange,
  creditFilter,
  onCreditFilterChange,
}: ModelCatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-3 bg-card p-4 rounded-2xl border border-primary/10 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">LLM Models Catalog & Auto-Pricing</h3>
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{totalItems}</span> matching models • Rate: 1 USD = 120 BDT
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers, IDs…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm rounded-xl border-primary/20 bg-background"
          />
        </div>
      </div>

      {/* Advanced Multi-Criteria Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Provider Filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[130px]">
          <Select value={providerFilter} onValueChange={onProviderFilterChange}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Providers</SelectItem>
              {uniqueProviders.map((p) => (
                <SelectItem key={p} value={p.toLowerCase()}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[150px]">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="deprecated">Deprecated Only</SelectItem>
              <SelectItem value="merchant-on">Merchant Active (ON)</SelectItem>
              <SelectItem value="merchant-off">Merchant Inactive (OFF)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Credit Cost Filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[140px]">
          <Select value={creditFilter} onValueChange={onCreditFilterChange}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Coins className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Credit Cost" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Credits</SelectItem>
              <SelectItem value="1">1 Credit (Fast)</SelectItem>
              <SelectItem value="3">3 Credits (Smart)</SelectItem>
              <SelectItem value="5">5 Credits (Genius)</SelectItem>
              <SelectItem value="custom">Custom Credits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
