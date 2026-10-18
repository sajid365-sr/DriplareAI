"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export interface ProductCardData {
  productId?: string;
  name?: string;
  price?: number | null;
  currency?: string;
  imageUrl?: string;
}

interface ProductCardStripProps {
  cards: ProductCardData[];
  onOpenImage: (url: string) => void;
}

/**
 * Parses the JSON payload the AI brain stores in a carousel message.
 * Invalid or partial data is ignored instead of breaking the whole inbox.
 */
export const parseProductCards = (raw?: string | null): ProductCardData[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((card): card is ProductCardData => {
        return !!card && typeof card === "object" && typeof card.imageUrl === "string";
      })
      .slice(0, 10);
  } catch {
    return [];
  }
};

const formatPrice = (card: ProductCardData): string => {
  const raw = card.price as unknown;
  if (raw === null || raw === undefined || raw === "") return "";
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return "";
  const currency = card.currency || "BDT";
  const symbol = currency === "BDT" ? "৳" : `${currency} `;
  return `${symbol}${amount.toLocaleString("en-US")}`;
};

/** A thumbnail that degrades to a placeholder when the URL is dead. */
const CardImage = ({ src, alt }: { src: string; alt: string }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-[88px] w-full items-center justify-center bg-muted">
        <ImageOff className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[88px] w-full object-cover transition-transform duration-200 group-hover:scale-105"
    />
  );
};

/**
 * Horizontal product cards shown inside an assistant bubble when the AI
 * sent a carousel. Mirrors what the customer received on Messenger,
 * Instagram or WhatsApp without needing a new database column.
 */
export const ProductCardStrip = ({ cards, onOpenImage }: ProductCardStripProps) => {
  if (cards.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-1">
      {cards.map((card, index) => {
        const name = String(card.name || "");
        const price = formatPrice(card);
        return (
          <button
            key={`${card.productId || card.imageUrl}-${index}`}
            type="button"
            onClick={() => onOpenImage(String(card.imageUrl))}
            title={name}
            className="group w-[132px] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/50"
          >
            <CardImage src={String(card.imageUrl)} alt={name} />
            <div className="px-2 py-1.5">
              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                {name}
              </p>
              {price && (
                <p className="mt-0.5 text-[11px] font-semibold text-primary">
                  {price}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
