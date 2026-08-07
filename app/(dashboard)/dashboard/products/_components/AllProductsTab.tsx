"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  X,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Check,
  FileText,
  Upload,
  Layers,
  LayoutGrid,
  List,
  Filter,
  Boxes,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { FacebookIcon } from "@/components/icons/PlatformIcons";
import { Button } from "@/components/ui/button";
import { SavedProductsGrid, type SavedProduct } from "./SavedProductsGrid";
import { SavedProductsTable } from "./SavedProductsTable";
import { ProductPagination, type PaginationMeta } from "./ProductPagination";

type AllProductsTabProps = {
  agentId: string;
  products: SavedProduct[];
  loadingProducts: boolean;
  paginationMeta: PaginationMeta | null;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onNavigateToSync: () => void;
};

export function AllProductsTab({
  agentId,
  products,
  loadingProducts,
  paginationMeta,
  onRefresh,
  onPageChange,
  onNavigateToSync,
}: AllProductsTabProps) {
  const { t } = useTranslation("products");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);

  // View Mode: 'grid' vs 'table' (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("driplare_product_view_mode");
      if (saved === "table" || saved === "grid") {
        setViewMode(saved);
      }
    } catch {
      // localStorage fallback
    }
  }, []);

  const handleViewModeChange = (mode: "grid" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("driplare_product_view_mode", mode);
    } catch {
      // fallback
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sourceRef.current && !sourceRef.current.contains(event.target as Node)) {
        setIsSourceOpen(false);
      }
      if (stockRef.current && !stockRef.current.contains(event.target as Node)) {
        setIsStockOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Source options configuration
  const sourceOptions = [
    { id: "all", label: t("filters.allSources"), icon: Layers, iconClass: "text-primary" },
    { id: "fb_post", label: t("filters.fbPost"), icon: FacebookIcon, iconClass: "text-[#1877F2]" },
    { id: "manual", label: t("filters.manual"), icon: Upload, iconClass: "text-emerald-400" },
    { id: "text", label: t("filters.text"), icon: FileText, iconClass: "text-violet-400" },
  ];

  // Stock options configuration
  const stockOptions = [
    { id: "all", label: "All Stock", color: "text-foreground" },
    { id: "in_stock", label: "In Stock (>5)", color: "text-emerald-500" },
    { id: "low_stock", label: "Low Stock (1-5)", color: "text-amber-500" },
    { id: "out_of_stock", label: "Out of Stock (0)", color: "text-rose-500" },
  ];

  const currentSourceOption = sourceOptions.find((opt) => opt.id === selectedSource) || sourceOptions[0];
  const SourceIcon = currentSourceOption.icon;
  const currentStockOption = stockOptions.find((opt) => opt.id === stockFilter) || stockOptions[0];

  // Filter products based on search, source, stock, price, and variants
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search match
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query));

      // Source match
      const matchesSource =
        selectedSource === "all" ||
        (selectedSource === "fb_post" && product.sourceType === "fb_post") ||
        (selectedSource === "manual" && (product.sourceType === "manual" || product.sourceType === "csv")) ||
        (selectedSource === "text" && product.sourceType === "text");

      // Stock match
      const stock = product.stock ?? 0;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in_stock" && stock > 5) ||
        (stockFilter === "low_stock" && stock >= 1 && stock <= 5) ||
        (stockFilter === "out_of_stock" && stock === 0);

      // Price match
      const price = product.price;
      const minP = minPrice ? Number(minPrice) : null;
      const maxP = maxPrice ? Number(maxPrice) : null;
      const matchesMinPrice = minP === null || (price !== null && price >= minP);
      const matchesMaxPrice = maxP === null || (price !== null && price <= maxP);

      // Variant match (colors / sizes)
      const vQuery = variantFilter.trim().toLowerCase();
      const colors = product.variants?.colors || [];
      const sizes = product.variants?.sizes || [];
      const matchesVariant =
        !vQuery ||
        colors.some((c) => c.toLowerCase().includes(vQuery)) ||
        sizes.some((s) => s.toLowerCase().includes(vQuery));

      return (
        matchesSearch &&
        matchesSource &&
        matchesStock &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesVariant
      );
    });
  }, [products, searchQuery, selectedSource, stockFilter, minPrice, maxPrice, variantFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedSource !== "all" ||
    stockFilter !== "all" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    variantFilter.trim() !== "";

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSource("all");
    setStockFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setVariantFilter("");
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="space-y-3 bg-card border border-border/60 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Search Bar & Filter Buttons */}
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full pl-9 pr-8 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/70"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Source Filter Dropdown */}
            <div className="relative" ref={sourceRef}>
              <button
                type="button"
                onClick={() => setIsSourceOpen(!isSourceOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
                  selectedSource !== "all"
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-foreground hover:bg-muted"
                }`}
              >
                <SourceIcon className={`w-3.5 h-3.5 ${currentSourceOption.iconClass}`} />
                <span>{currentSourceOption.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isSourceOpen ? "rotate-180" : ""}`} />
              </button>

              {isSourceOpen && (
                <div className="absolute left-0 top-full mt-2 z-30 w-48 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Filter by Source
                  </div>
                  {sourceOptions.map((option) => {
                    const ItemIcon = option.icon;
                    const isSelected = selectedSource === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedSource(option.id);
                          setIsSourceOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ItemIcon className={`w-3.5 h-3.5 ${option.iconClass}`} />
                          <span>{option.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stock Filter Dropdown */}
            <div className="relative" ref={stockRef}>
              <button
                type="button"
                onClick={() => setIsStockOpen(!isStockOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
                  stockFilter !== "all"
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-foreground hover:bg-muted"
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-emerald-500" />
                <span>{currentStockOption.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isStockOpen ? "rotate-180" : ""}`} />
              </button>

              {isStockOpen && (
                <div className="absolute left-0 top-full mt-2 z-30 w-48 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Filter by Stock Status
                  </div>
                  {stockOptions.map((opt) => {
                    const isSelected = stockFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStockFilter(opt.id as any);
                          setIsStockOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className={opt.color}>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Advanced Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
                minPrice || maxPrice || variantFilter
                  ? "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400"
                  : "bg-muted/40 border-border/60 text-foreground hover:bg-muted"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
              <span>More Filters</span>
              {(minPrice || maxPrice || variantFilter) && (
                <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Right: View Mode Toggle & Sync Actions */}
          <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/60">
            {/* View Mode Switcher Toggle Group ([ Grid ] [ Table ]) */}
            <div className="flex items-center p-0.5 bg-muted/60 rounded-xl border border-border/60 shadow-2xs">
              <button
                type="button"
                onClick={() => handleViewModeChange("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-2xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5 text-violet-400" />
                <span className="hidden md:inline">Table</span>
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
              <Sparkles className="w-3 h-3" />
              {hasActiveFilters
                ? `${filteredProducts.length} / ${products.length}`
                : t("catalog.count", { count: products.length })}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loadingProducts}
              className="gap-2 text-xs h-9 rounded-xl border-border/60 hover:bg-muted"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Expandable Advanced Multi-Filter Drawer Panel (Price Range & Color/Size) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
            {/* Min Price */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Min Price (৳)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs outline-none focus:border-primary"
              />
            </div>

            {/* Max Price */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Max Price (৳)
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs outline-none focus:border-primary"
              />
            </div>

            {/* Color / Size Search */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                Color / Size Variant
              </label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. Black, XL, Olive"
                  value={variantFilter}
                  onChange={(e) => setVariantFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Catalog Grid Content Area */}
      {loadingProducts ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card/50 border border-border/60 rounded-2xl text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading catalog products...</p>
        </div>
      ) : filteredProducts.length === 0 && hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-card border border-dashed border-border/60 rounded-2xl text-center">
          <p className="text-sm font-semibold text-foreground mb-1">{t("filters.noResults")}</p>
          <p className="text-xs text-muted-foreground mb-4">
            Try adjusting your search query or source filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs rounded-xl"
          >
            {t("filters.clear")}
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <SavedProductsTable
          agentId={agentId}
          products={filteredProducts}
          onRefresh={onRefresh}
        />
      ) : (
        <SavedProductsGrid
          agentId={agentId}
          products={filteredProducts}
          onRefresh={onRefresh}
        />
      )}

      {/* Pagination Footer — only when no active client-side filters and meta is available */}
      {!hasActiveFilters && paginationMeta && paginationMeta.totalPages > 1 && (
        <ProductPagination meta={paginationMeta} onPageChange={onPageChange} />
      )}
    </div>
  );
}

