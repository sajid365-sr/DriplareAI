"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Package, Pencil, Trash2, ExternalLink, FileText, Upload, Images } from "lucide-react";
import { FacebookIcon } from "@/components/icons/PlatformIcons";
import { EditProductModal } from "./EditProductModal";
import { DeleteProductModal } from "./DeleteProductModal";
import { ProductImage } from "./ProductImage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SavedProduct = {
  id: string;
  productId: string;
  chatbotId: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  stock?: number;
  variants: { colors?: string[]; sizes?: string[]; [key: string]: string[] | undefined } | null;
  sourceType: string;
  sourcePostId: string | null;
  imageUrl: string | null;
  imageUrls: string[]; // Multiple gallery image URLs
  postUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

type SavedProductsGridProps = {
  agentId: string;
  products: SavedProduct[];
  onRefresh: () => void;
};

/**
 * Displays saved products as a responsive card grid.
 * Supports edit (modal) and custom delete confirmation modal.
 */
export function SavedProductsGrid({ agentId, products, onRefresh }: SavedProductsGridProps) {
  const { t } = useTranslation("products");
  const [editingProduct, setEditingProduct] = useState<SavedProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<SavedProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chatbots/${agentId}/products/${productToDelete.productId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("catalog.deleteSuccess"));
      setProductToDelete(null);
      onRefresh();
    } catch {
      toast.error(t("catalog.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Package className="h-7 w-7" />
        </span>
        <p className="font-medium text-foreground">{t("catalog.empty")}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("catalog.emptySubtitle")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.productId}
            product={product}
            isDeleting={isDeleting && productToDelete?.productId === product.productId}
            onEdit={() => setEditingProduct(product)}
            onDelete={() => setProductToDelete(product)}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editingProduct && (
        <EditProductModal
          agentId={agentId}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            onRefresh();
          }}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {productToDelete && (
        <DeleteProductModal
          isOpen={!!productToDelete}
          productName={productToDelete.name}
          isDeleting={isDeleting}
          onClose={() => setProductToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

type ProductCardProps = {
  product: SavedProduct;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function ProductCard({ product, isDeleting, onEdit, onDelete }: ProductCardProps) {
  const { t } = useTranslation("products");
  const colors = product.variants?.colors ?? [];
  const sizes = product.variants?.sizes ?? [];

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/30 hover:shadow-md ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {/* Use imageUrls[0] as primary, fall back to imageUrl */}
        <ProductImage
          src={(product.imageUrls?.[0]) || product.imageUrl}
          alt={product.name}
          className="absolute inset-0 h-full w-full"
          imgClassName="group-hover:scale-105"
          iconSize="h-10 w-10"
        />

        {/* Gallery Photo Count Badge — shown when multiple images exist */}
        {product.imageUrls && product.imageUrls.length > 1 && (
          <span className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs shadow-xs">
            <Images className="h-2.5 w-2.5" />
            {product.imageUrls.length}
          </span>
        )}

        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-lg bg-background/90 px-2 py-1 text-xs font-bold shadow-xs backdrop-blur-md border border-border/40">
          {product.sourceType === "fb_post" ? (
            <>
              <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2]" />
              <span className="text-[#1877F2]">Facebook</span>
            </>
          ) : product.sourceType === "text" ? (
            <>
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-foreground">Text Context</span>
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-foreground">CSV / Manual</span>
            </>
          )}
        </div>

        {/* Action buttons — appear on hover */}
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-primary hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/90 text-destructive shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
            {product.name}
          </h3>
          {product.price && (
            <span className="shrink-0 text-sm font-bold text-emerald-500">
              ৳ {product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Stock Badge */}
        {(() => {
          const stock = product.stock ?? 0;
          if (stock > 5) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                In Stock ({stock})
              </span>
            );
          } else if (stock >= 1) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Low Stock ({stock})
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Out of Stock
              </span>
            );
          }
        })()}

        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        )}

        {/* Variants */}
        {(colors.length > 0 || sizes.length > 0) && (
          <div className="space-y-1">
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {colors.slice(0, 4).map((c, i) => (
                  <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
                    {c}
                  </span>
                ))}
                {colors.length > 4 && (
                  <span className="text-xs text-muted-foreground">+{colors.length - 4}</span>
                )}
              </div>
            )}
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sizes.slice(0, 5).map((s, i) => (
                  <span key={i} className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-600 dark:text-violet-400">
                    {s}
                  </span>
                ))}
                {sizes.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{sizes.length - 5}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Post link */}
        {product.postUrl && (
          <a
            href={product.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
            title={t("catalog.title")}
          >
            <ExternalLink className="h-3 w-3" />
            View post
          </a>
        )}
      </div>
    </div>
  );
}
