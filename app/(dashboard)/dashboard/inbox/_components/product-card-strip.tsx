"use client";

import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ProductCardData {
  productId?: string;
  name?: string;
  price?: number | null;
  currency?: string;
  imageUrl?: string;
  /** Original Facebook/Instagram post — the same link the card's Details button opens. */
  postUrl?: string;
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
  const { t } = useTranslation("live-inbox");

  if (cards.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-1">
      {cards.map((card, index) => {
        const name = String(card.name || "");
        const price = formatPrice(card);
        const postUrl = /^https:\/\//i.test(String(card.postUrl || ""))
          ? String(card.postUrl)
          : "";

        return (
          <div
            key={`${card.productId || card.imageUrl}-${index}`}
            className="group relative w-[132px] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/50"
          >
            <button
              type="button"
              onClick={() => onOpenImage(String(card.imageUrl))}
              title={name}
              className="block w-full cursor-zoom-in"
            >
              <CardImage src={String(card.imageUrl)} alt={name} />
            </button>

            {/* Mirrors the customer's Details button: opens the original post,
                where the full image gallery lives. */}
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noreferrer"
                title={t("productCard.openPost")}
                aria-label={t("productCard.openPost")}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

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
          </div>
        );
      })}
    </div>
  );
};
