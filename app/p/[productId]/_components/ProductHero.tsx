"use client";

import { useState } from "react";
import { ImageOff, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface ProductHeroProps {
  name: string;
  price: number | null;
  currency?: string;
  stock: number;
  description: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
}

export function ProductHero({
  name,
  price,
  currency = "BDT",
  stock,
  description,
  imageUrl,
  imageUrls = [],
}: ProductHeroProps) {
  const { t } = useTranslation("product-page");

  // Collect all available gallery images
  const allImages = Array.from(
    new Set([imageUrl, ...(imageUrls || [])].filter((url): url is string => Boolean(url)))
  );

  const [activeImage, setActiveImage] = useState<string | null>(
    allImages.length > 0 ? allImages[0] : null
  );
  const [imgError, setImgError] = useState(false);

  const isAvailable = stock > 0;
  const currencySymbol = currency === "BDT" ? "৳" : `${currency} `;

  return (
    <div className="space-y-4">
      {/* Product Image Stage */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {activeImage && !imgError ? (
          <motion.img
            key={activeImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            src={activeImage}
            alt={name}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/40 text-muted-foreground">
            <ImageOff className="h-10 w-10 stroke-[1.5]" />
            <span className="mt-2 text-xs font-medium">{t("productDetails")}</span>
          </div>
        )}

        {/* Floating Stock Badge */}
        <div className="absolute top-3 right-3">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 backdrop-blur-md">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("inStock")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 backdrop-blur-md">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("outOfStock")}
            </span>
          )}
        </div>
      </div>

      {/* Thumbnails Gallery */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {allImages.map((img, idx) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => {
                setActiveImage(img);
                setImgError(false);
              }}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                activeImage === img
                  ? "border-violet-600 ring-2 ring-violet-500/20 scale-105"
                  : "border-border/60 opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img} alt={`${name} ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Title & Price Header */}
      <div className="space-y-2 pt-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {name}
        </h1>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {currencySymbol}
            {price ? price.toLocaleString() : "0"}
          </span>
          {price && (
            <span className="text-sm font-medium text-muted-foreground line-through">
              {currencySymbol}
              {(price * 1.2).toFixed(0)}
            </span>
          )}
        </div>

        {/* Low Stock Warning */}
        {isAvailable && stock <= 5 && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            {t("stockLeft", { count: stock })}
          </p>
        )}

        {/* Description */}
        {description && (
          <div className="pt-2">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
