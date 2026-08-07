"use client";

import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";

type ProductsHeaderProps = {
  credits: number | null;
};

/**
 * Products page header — title, subtitle, and credit balance badge.
 */
export function ProductsHeader({ credits }: ProductsHeaderProps) {
  const { t } = useTranslation("products");

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Package className="h-6 w-6 text-primary" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {credits !== null && (
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <span className="text-xs opacity-70">Credits</span>
          <span className="font-bold">{credits.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
