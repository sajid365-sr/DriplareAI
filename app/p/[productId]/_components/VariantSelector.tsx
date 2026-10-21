"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface VariantSelectorProps {
  variants?: Record<string, string[]> | null;
  selectedVariants: Record<string, string>;
  onSelectVariant: (key: string, value: string) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  maxStock: number;
}

export function VariantSelector({
  variants,
  selectedVariants,
  onSelectVariant,
  quantity,
  onQuantityChange,
  maxStock,
}: VariantSelectorProps) {
  const { t } = useTranslation("product-page");

  const hasVariants =
    variants &&
    typeof variants === "object" &&
    Object.keys(variants).length > 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Dynamic Variant Options (Size, Color, etc.) */}
      {hasVariants &&
        Object.entries(variants).map(([category, options]) => {
          if (!Array.isArray(options) || options.length === 0) return null;

          const activeValue = selectedVariants[category];

          return (
            <div key={category} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category}:{" "}
                <span className="font-bold text-foreground">
                  {activeValue || t("selectVariant")}
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const isSelected = activeValue === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onSelectVariant(category, option)}
                      className={`relative min-h-[38px] min-w-[44px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-violet-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-500/30"
                          : "border border-border/80 bg-card text-foreground hover:border-violet-500/50 hover:bg-muted/40"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Quantity Counter */}
      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("quantity")}
          </label>
        </div>

        <div className="flex items-center rounded-xl border border-border/80 bg-card shadow-xs">
          <button
            type="button"
            disabled={quantity <= 1}
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-l-xl text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-sm font-bold text-foreground">
            {quantity}
          </span>
          <button
            type="button"
            disabled={maxStock > 0 && quantity >= maxStock}
            onClick={() => onQuantityChange(quantity + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-r-xl text-foreground transition-colors hover:bg-muted/60 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
