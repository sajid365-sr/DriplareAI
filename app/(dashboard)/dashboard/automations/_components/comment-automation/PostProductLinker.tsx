"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Package, Search, Check, Link as LinkIcon, ImageOff } from "lucide-react";

interface SimpleProduct {
  productId: string;
  name: string;
  price?: number | null;
  currency?: string;
  imageUrl?: string | null;
}

interface PostProductLinkerProps {
  chatbotId: string;
  selectedProductIds: string[];
  onChangeProductIds: (productIds: string[]) => void;
  postUrl: string;
  onChangePostUrl: (url: string) => void;
  postId: string;
  onChangePostId: (id: string) => void;
}

export function PostProductLinker({
  chatbotId,
  selectedProductIds,
  onChangeProductIds,
  postUrl,
  onChangePostUrl,
  postId,
  onChangePostId,
}: PostProductLinkerProps) {
  const { t } = useTranslation("automations");

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Extract post ID from URL if user pastes a Facebook/Instagram URL
  const handleUrlChange = (value: string) => {
    onChangePostUrl(value);
    if (!postId || postId.startsWith("post_")) {
      const fbMatch = value.match(/(?:posts\/|fbid=|story_fbid=)([0-9]+)/);
      const igMatch = value.match(/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      if (fbMatch?.[1]) {
        onChangePostId(fbMatch[1]);
      } else if (igMatch?.[1]) {
        onChangePostId(igMatch[1]);
      } else if (value.trim() && !postId) {
        onChangePostId(`post_${Date.now()}`);
      }
    }
  };

  useEffect(() => {
    if (!chatbotId) return;
    let ignore = false;

    fetch(`/api/chatbots/${chatbotId}/products?limit=50`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.data) {
          setProducts(data.data);
        }
      })
      .catch((err) => {
        console.warn("[POST_PRODUCT_LINKER_FETCH_ERR]", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [chatbotId]);

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onChangeProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      onChangeProductIds([...selectedProductIds, productId]);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      {/* Post URL and ID Inputs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            {t("commentAutomation.postLabel", "Post URL or Permalink")} *
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              required
              value={postUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://facebook.com/.../posts/12345"
              className="w-full rounded-xl border border-border/80 bg-background pl-8.5 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Post ID *
          </label>
          <input
            type="text"
            required
            value={postId}
            onChange={(e) => onChangePostId(e.target.value)}
            placeholder="1234567890"
            className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
          />
        </div>
      </div>

      {/* Product Linker Picker */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-violet-500" />
              <span>{t("commentAutomation.linkProducts", "Linked Catalog Products")}</span>
            </label>
            <p className="text-[11px] text-muted-foreground">
              {t("commentAutomation.linkProductsDesc", "Select products to recommend in replies")}
            </p>
          </div>
          <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
            {selectedProductIds.length} selected
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter products..."
            className="w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-600"
          />
        </div>

        {/* Product Cards Grid */}
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {loading ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Loading products...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((prod) => {
              const isSelected = selectedProductIds.includes(prod.productId);
              return (
                <button
                  key={prod.productId}
                  type="button"
                  onClick={() => toggleProduct(prod.productId)}
                  className={`flex w-full items-center justify-between rounded-lg border p-2 text-left transition-all ${
                    isSelected
                      ? "border-violet-600 bg-violet-500/10 ring-1 ring-violet-500/30"
                      : "border-border/60 bg-background/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {prod.name}
                      </p>
                      {prod.price && (
                        <p className="text-[11px] text-muted-foreground">
                          ৳{prod.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isSelected
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-border"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-3 text-center text-xs text-muted-foreground">
              No products found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
