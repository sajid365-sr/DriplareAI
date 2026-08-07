"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  /** Image source URL. Pass null/undefined to render fallback immediately. */
  src: string | null | undefined;
  /** Alt text for the image */
  alt: string;
  /** Extra Tailwind classes applied to the outer container div */
  className?: string;
  /** Extra Tailwind classes applied to the <img> tag itself */
  imgClassName?: string;
  /** Icon size class for the fallback placeholder (default: h-8 w-8) */
  iconSize?: string;
};

/**
 * A robust product image component that gracefully handles:
 *  - Missing / null / undefined src → renders gradient fallback
 *  - Broken URL (onError) → falls back to gradient placeholder
 *
 * Use this anywhere in the product catalog instead of raw <img> tags.
 */
export function ProductImage({
  src,
  alt,
  className,
  imgClassName,
  iconSize = "h-8 w-8",
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  const showFallback = !src || hasError;

  return (
    <div
      className={cn(
        "overflow-hidden",
        showFallback &&
          "flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/50 to-purple-50/30 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-700/40",
        className
      )}
    >
      {showFallback ? (
        <ShoppingCart
          className={cn(iconSize, "text-violet-400 dark:text-violet-400")}
          strokeWidth={1.5}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className={cn(
            "h-full w-full object-cover transition-transform duration-300",
            imgClassName
          )}
        />
      )}
    </div>
  );
}
