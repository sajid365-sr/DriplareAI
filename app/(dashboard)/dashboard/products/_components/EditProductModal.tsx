"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import type { SavedProduct } from "./SavedProductsGrid";
import { ProductImageUploader } from "./ProductImageUploader";

type EditProductModalProps = {
  agentId: string;
  product: SavedProduct;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Edit Product Drawer using Shadcn UI Drawer component.
 * Opens from the right side (`swipeDirection="right"`).
 * Includes sticky header, scrollable body, and sticky bottom footer with action buttons.
 */
export function EditProductModal({ agentId, product, onClose, onSaved }: EditProductModalProps) {
  const { t } = useTranslation("products");

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState<string>(product.price ? String(product.price) : "");
  const [currency, setCurrency] = useState(product.currency || "BDT");
  const [stock, setStock] = useState<string>(product.stock !== undefined ? String(product.stock) : "10");
  const [colors, setColors] = useState((product.variants?.colors || []).join(", "));
  const [sizes, setSizes] = useState((product.variants?.sizes || []).join(", "));
  // Support both legacy imageUrl and new imageUrls gallery
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
      return product.imageUrls.filter(Boolean);
    }
    return product.imageUrl ? [product.imageUrl] : [];
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const colorArr = colors.split(",").map((s) => s.trim()).filter(Boolean);
      const sizeArr = sizes.split(",").map((s) => s.trim()).filter(Boolean);

      const variants = {
        ...(colorArr.length > 0 && { colors: colorArr }),
        ...(sizeArr.length > 0 && { sizes: sizeArr }),
      };

      const res = await fetch(`/api/chatbots/${agentId}/products/${product.productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: price ? Number(price) : null,
          currency: currency.trim() || "BDT",
          stock: stock !== "" ? Math.max(0, Number(stock)) : 0,
          variants: Object.keys(variants).length > 0 ? variants : null,
          imageUrls,
          imageUrl: imageUrls[0] || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update product");
      toast.success(t("catalog.editSuccess"));
      onSaved();
    } catch {
      toast.error(t("catalog.editFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={true} onOpenChange={(open) => { if (!open) onClose(); }} swipeDirection="right">
      <DrawerContent className="w-full sm:max-w-lg">
        {/* Drawer Header */}
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <DrawerTitle className="text-base font-bold text-foreground">
              {t("editModal.title")}
            </DrawerTitle>
          </div>
          <DrawerClose
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </DrawerClose>
        </DrawerHeader>

        {/* Scrollable Form & Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Product Name */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {t("editModal.nameLabel")}
              </label>
              <input
                required
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Price, Currency & Stock */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  {t("editModal.priceLabel")}
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  {t("editModal.currencyLabel")}
                </label>
                <input
                  className={inputCls}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Stock / Qty
                </label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {t("editModal.colorsLabel")}
              </label>
              <input
                className={inputCls}
                placeholder="White, Blue, Black"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
              />
            </div>

            {/* Sizes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {t("editModal.sizesLabel")}
              </label>
              <input
                className={inputCls}
                placeholder="S, M, L, XL"
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
              />
            </div>

            {/* Product Gallery Uploader (Multi-Image) */}
            <div>
              <ProductImageUploader
                agentId={agentId}
                imageUrls={imageUrls}
                currentImageUrl={product.imageUrl}
                onImagesUpdated={(urls) => setImageUrls(urls)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {t("editModal.descriptionLabel")}
              </label>
              <textarea
                rows={4}
                className={`${inputCls} resize-none`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Sticky Bottom Drawer Footer — ALWAYS VISIBLE & CLICKABLE */}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-card p-4 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs font-semibold h-9"
            >
              {t("editModal.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t("editModal.save")}
                </>
              )}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
