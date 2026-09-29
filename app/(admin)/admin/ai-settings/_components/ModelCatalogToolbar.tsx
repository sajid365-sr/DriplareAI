"use client";

import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ArrowUpDown, Brain, Coins, Filter, Search, Tag, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  USD_TO_BDT_RATE_MAX,
  USD_TO_BDT_RATE_MIN,
} from "@/lib/domain/credit-config";
import { type PriceRange, type PriceSort } from "./price-filter";

interface ModelCatalogToolbarProps {
  totalItems: number;
  /** USD → BDT rate currently held by the page — the one Save will persist. */
  usdToBdtRate: number;
  onUsdToBdtRateChange: (rate: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  providerFilter: string;
  onProviderFilterChange: (provider: string) => void;
  uniqueProviders: string[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  creditFilter: string;
  onCreditFilterChange: (credit: string) => void;
  priceSort: PriceSort;
  onPriceSortChange: (sort: PriceSort) => void;
  priceRange: PriceRange;
  onPriceRangeChange: (range: PriceRange) => void;
}

export function ModelCatalogToolbar({
  totalItems,
  usdToBdtRate,
  onUsdToBdtRateChange,
  searchQuery,
  onSearchChange,
  providerFilter,
  onProviderFilterChange,
  uniqueProviders,
  statusFilter,
  onStatusFilterChange,
  creditFilter,
  onCreditFilterChange,
  priceSort,
  onPriceSortChange,
  priceRange,
  onPriceRangeChange,
}: ModelCatalogToolbarProps) {
  const { t } = useTranslation("admin");

  // ── USD → BDT rate input ────────────────────────────────────────────────────
  // The page holds the rate as a number, but a number input being typed into is
  // text: "12" on the way to "129", or a transient "" after clearing. Keeping a
  // local draft lets those states exist without the parent rejecting them
  // mid-keystroke.
  const [rateDraft, setRateDraft] = useState(String(usdToBdtRate));

  // ⚠️ React-এর নিজের "prop বদলালে state বদলাও" প্যাটার্ন — effect নয়।
  //    effect-এ setState করলে একটা বাড়তি রেন্ডার হয় (eslint-ও ধরে), আর দরকারও
  //    নেই: এখানে আমরা শুধু props-এর সাথে তাল মিলিয়ে চলছি। admin সেভ করার পর
  //    বা ReFetch-এর পর রেট বদলালে input-টা নিজে থেকে নতুন মান দেখাবে।
  const [syncedRate, setSyncedRate] = useState(usdToBdtRate);
  if (syncedRate !== usdToBdtRate) {
    setSyncedRate(usdToBdtRate);
    setRateDraft(String(usdToBdtRate));
  }

  const handleRateChange = (raw: string) => {
    setRateDraft(raw);
    const parsed = Number(raw);
    // Only well-formed positive numbers travel up. Range clamping is left to the
    // save path, so a half-typed value is never silently rewritten under the cursor.
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
      onUsdToBdtRateChange(parsed);
    }
  };

  const handleRateBlur = () => {
    const parsed = Number(rateDraft);
    // Empty or nonsense on blur → snap back to the value that is actually saved.
    setRateDraft(
      rateDraft.trim() === "" || !Number.isFinite(parsed) || parsed <= 0
        ? String(usdToBdtRate)
        : String(parsed),
    );
  };

  return (
    <div className="flex flex-col gap-3 bg-card p-4 rounded-2xl border border-primary/10 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground">{t("aiSettings.catalog.title")}</h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                <Trans
                  t={t}
                  i18nKey="aiSettings.catalog.showing"
                  values={{ count: totalItems }}
                  components={[<span key="count" className="font-semibold text-foreground" />]}
                />
              </span>

              <span aria-hidden="true" className="text-muted-foreground/40">
                •
              </span>

              {/* ── The editable USD → BDT rate ──
                  One rate governs every ৳ figure — this panel's price previews
                  and all analytics/reports. The real rate drifts daily, so it is
                  never hardcoded; it is stored in `ai_credit_rules.usdToBdtRate`
                  and applied by `getUsdToBdtRate()` on the server. */}
              <label
                htmlFor="usd-to-bdt-rate"
                className="flex items-center gap-1.5"
                title={t("aiSettings.catalog.rateHint")}
              >
                <span className="whitespace-nowrap">{t("aiSettings.catalog.rateLabel")}</span>
                <Input
                  id="usd-to-bdt-rate"
                  type="number"
                  inputMode="decimal"
                  min={USD_TO_BDT_RATE_MIN}
                  max={USD_TO_BDT_RATE_MAX}
                  step={0.1}
                  value={rateDraft}
                  onChange={(e) => handleRateChange(e.target.value)}
                  onBlur={handleRateBlur}
                  aria-label={t("aiSettings.catalog.rateLabel")}
                  className="h-6 w-16 shrink-0 rounded-md border-primary/20 bg-background px-1.5 text-center text-xs font-semibold text-foreground shadow-none focus-visible:ring-1 md:text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="whitespace-nowrap">{t("aiSettings.catalog.rateSuffix")}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("aiSettings.catalog.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm rounded-xl border-primary/20 bg-background"
          />
        </div>
      </div>

      {/* Advanced Multi-Criteria Filter Bar
          পাঁচটা কন্ট্রোল — তাই `sm:flex-nowrap` তুলে দেওয়া হয়েছে। নাহলে মাঝারি
          স্ক্রিনে প্রতিটা Select চেপে এত সরু হয়ে যেত যে লেখা কাটা পড়ত। এখন
          চওড়া স্ক্রিনে এক সারিতে (flex-1), ছোট স্ক্রিনে ভেঙে দুই-দুইটা করে বসে। */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Provider Filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[130px]">
          <Select value={providerFilter} onValueChange={(value) => onProviderFilterChange(value ?? "all")}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={t("aiSettings.catalog.filters.providerPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t("aiSettings.catalog.filters.allProviders")}</SelectItem>
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
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value ?? "all")}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={t("aiSettings.catalog.filters.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t("aiSettings.catalog.filters.allStatus")}</SelectItem>
              <SelectItem value="active">{t("aiSettings.catalog.filters.activeOnly")}</SelectItem>
              <SelectItem value="deprecated">{t("aiSettings.catalog.filters.deprecatedOnly")}</SelectItem>
              <SelectItem value="merchant-on">{t("aiSettings.catalog.filters.merchantOn")}</SelectItem>
              <SelectItem value="merchant-off">{t("aiSettings.catalog.filters.merchantOff")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Credit Cost Filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[140px]">
          <Select value={creditFilter} onValueChange={(value) => onCreditFilterChange(value ?? "all")}>
            <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background">
              <Coins className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={t("aiSettings.catalog.filters.creditPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t("aiSettings.catalog.filters.allCredits")}</SelectItem>
              <SelectItem value="1">{t("aiSettings.catalog.filters.creditFast")}</SelectItem>
              <SelectItem value="3">{t("aiSettings.catalog.filters.creditSmart")}</SelectItem>
              <SelectItem value="5">{t("aiSettings.catalog.filters.creditGenius")}</SelectItem>
              <SelectItem value="custom">{t("aiSettings.catalog.filters.customCredits")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Range Filter — narrows the list to a band of per-1M cost. */}
        <div className="w-full sm:w-auto flex-1 min-w-[150px]">
          <Select
            value={priceRange}
            onValueChange={(value) => onPriceRangeChange((value ?? "all") as PriceRange)}
          >
            <SelectTrigger
              className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background"
              title={t("aiSettings.catalog.filters.priceHint")}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={t("aiSettings.catalog.filters.priceRangePlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t("aiSettings.catalog.filters.priceRangeAll")}</SelectItem>
              <SelectItem value="under-1">{t("aiSettings.catalog.filters.priceRangeUnder1")}</SelectItem>
              <SelectItem value="1-to-5">{t("aiSettings.catalog.filters.priceRange1to5")}</SelectItem>
              <SelectItem value="above-5">{t("aiSettings.catalog.filters.priceRangeAbove5")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Sort — brings the cheapest or the priciest model to the top. */}
        <div className="w-full sm:w-auto flex-1 min-w-[160px]">
          <Select
            value={priceSort}
            onValueChange={(value) => onPriceSortChange((value ?? "default") as PriceSort)}
          >
            <SelectTrigger
              className="h-9 w-full rounded-xl text-xs sm:text-sm border-primary/20 bg-background"
              title={t("aiSettings.catalog.filters.priceHint")}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder={t("aiSettings.catalog.filters.priceSortPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="default">{t("aiSettings.catalog.filters.priceSortDefault")}</SelectItem>
              <SelectItem value="low-high">{t("aiSettings.catalog.filters.priceSortLowHigh")}</SelectItem>
              <SelectItem value="high-low">{t("aiSettings.catalog.filters.priceSortHighLow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
