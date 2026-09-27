"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ProductImageUploader } from "./ProductImageUploader";

type AddSingleProductDrawerProps = {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Add Single Product Drawer using Shadcn UI Drawer component.
 * Opens from the right side (`swipeDirection="right"`).
 * Features sticky header, scrollable body, and sticky bottom action footer.
 */
export function AddSingleProductDrawer({
  agentId,
  isOpen,
  onClose,
  onSuccess,
}: AddSingleProductDrawerProps) {
  const { t } = useTranslation("products");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [stock, setStock] = useState("10");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCurrency("BDT");
    setStock("10");
    setColors("");
    setSizes("");
    setImageUrls([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setSaving(true);
    try {
      const colorArr = colors.split(",").map((s) => s.trim()).filter(Boolean);
      const sizeArr = sizes.split(",").map((s) => s.trim()).filter(Boolean);

      const variants = {
        ...(colorArr.length > 0 && { colors: colorArr }),
        ...(sizeArr.length > 0 && { sizes: sizeArr }),
      };

      const res = await fetch(`/api/chatbots/${agentId}/products/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          price: price ? Number(price) : undefined,
          currency: currency.trim() || "BDT",
          stock: stock !== "" ? Math.max(0, Number(stock)) : 10,
          variants: Object.keys(variants).length > 0 ? variants : undefined,
          imageUrls,
          imageUrl: imageUrls[0] || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add product");
      }

      toast.success(t("catalog.addSuccess", "Product added successfully!"));
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add product";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} swipeDirection="right">
      <DrawerContent className="w-full sm:max-w-lg">
        {/* Drawer Header */}
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <DrawerTitle className="text-base font-bold text-foreground">
              Add Single Product
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
          {/* Form Fields Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Product Name */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Product Name <span className="text-destructive">*</span>
              </label>
              <input
                required
                className={inputCls}
                placeholder="e.g. Irani Borka, Black"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Price, Currency & Stock */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Price
                </label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="2500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Currency
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
                  placeholder="10"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Colors (comma separated)
              </label>
              <input
                className={inputCls}
                placeholder="Black, Olive, Purple"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
              />
            </div>

            {/* Sizes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Sizes (comma separated)
              </label>
              <input
                className={inputCls}
                placeholder="Free Size, M, L, XL"
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
              />
            </div>

            {/* Product Gallery Uploader (Multi-Image) */}
            <div>
              <ProductImageUploader
                agentId={agentId}
                imageUrls={imageUrls}
                onImagesUpdated={(urls) => setImageUrls(urls)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Description
              </label>
              <textarea
                rows={4}
                className={`${inputCls} resize-none`}
                placeholder="Enter detailed product description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Sticky Bottom Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-card p-4 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs font-semibold h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5 shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Product...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Save Product
                </>
              )}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
