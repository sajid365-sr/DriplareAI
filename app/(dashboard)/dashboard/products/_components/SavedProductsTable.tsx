"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Package, Pencil, Trash2, ExternalLink, FileText, Upload, Images } from "lucide-react";
import { FacebookIcon } from "@/components/icons/PlatformIcons";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EditProductModal } from "./EditProductModal";
import { DeleteProductModal } from "./DeleteProductModal";
import { ProductImage } from "./ProductImage";
import type { SavedProduct } from "./SavedProductsGrid";

type SavedProductsTableProps = {
  agentId: string;
  products: SavedProduct[];
  onRefresh: () => void;
};

/**
 * Displays saved products in a clean, responsive Shadcn UI Table layout.
 * Supports quick edit drawer and custom delete confirmation modal.
 */
export function SavedProductsTable({ agentId, products, onRefresh }: SavedProductsTableProps) {
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
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="w-14 text-xs font-bold text-muted-foreground">Image</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground">Product & Details</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground">Source</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground">Price</TableHead>
              <TableHead className="text-xs font-bold text-muted-foreground">Stock</TableHead>
              <TableHead className="w-24 text-right text-xs font-bold text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product) => {
              const colors = product.variants?.colors ?? [];
              const sizes = product.variants?.sizes ?? [];
              const isBeingDeleted = isDeleting && productToDelete?.productId === product.productId;
              const stock = product.stock ?? 0;

              return (
                <TableRow
                  key={product.productId}
                  className={`border-border/50 hover:bg-muted/40 transition-colors ${
                    isBeingDeleted ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Thumbnail Image */}
                  <TableCell className="p-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                      <ProductImage
                        src={(product.imageUrls?.[0]) || product.imageUrl}
                        alt={product.name}
                        className="h-full w-full"
                        iconSize="h-5 w-5"
                      />
                      {/* Gallery count mini-badge */}
                      {product.imageUrls && product.imageUrls.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-xs">
                          {product.imageUrls.length}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Title & Description & Variant Pills */}
                  <TableCell className="p-3">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground line-clamp-1">
                          {product.name}
                        </span>
                        {product.postUrl && (
                          <a
                            href={product.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="View source post"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {product.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      )}

                      {/* Variant Badges */}
                      {(colors.length > 0 || sizes.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {colors.map((c, i) => (
                            <span
                              key={`c-${i}`}
                              className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              {c}
                            </span>
                          ))}
                          {sizes.map((s, i) => (
                            <span
                              key={`s-${i}`}
                              className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Source Badge */}
                  <TableCell className="p-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/50 px-2 py-1 text-xs font-medium text-foreground shadow-2xs">
                      {product.sourceType === "fb_post" ? (
                        <>
                          <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2]" />
                          <span className="text-[#1877F2] font-semibold">Facebook</span>
                        </>
                      ) : product.sourceType === "text" ? (
                        <>
                          <FileText className="h-3.5 w-3.5 text-violet-400" />
                          <span>Text Context</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 text-emerald-400" />
                          <span>CSV / Manual</span>
                        </>
                      )}
                    </span>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="p-3">
                    {product.price ? (
                      <span className="font-bold text-xs text-emerald-500">
                        ৳ {product.price.toLocaleString()} {product.currency || "BDT"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-normal">N/A</span>
                    )}
                  </TableCell>

                  {/* Stock Status Badge */}
                  <TableCell className="p-3">
                    {stock > 5 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        In Stock ({stock})
                      </span>
                    ) : stock >= 1 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        Low Stock ({stock})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        Out of Stock
                      </span>
                    )}
                  </TableCell>

                  {/* Action Buttons */}
                  <TableCell className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                        title="Edit product"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        title="Delete product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit drawer */}
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
