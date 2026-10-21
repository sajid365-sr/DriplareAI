"use client";

import { useState } from "react";
import { ProductHero } from "./ProductHero";
import { VariantSelector } from "./VariantSelector";
import { OrderForm } from "./OrderForm";
import { OrderConfirmation } from "./OrderConfirmation";

export interface SerializedProduct {
  productId: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  stock: number;
  imageUrl: string | null;
  imageUrls: string[];
  variants: Record<string, string[]> | null;
}

interface ProductPageClientProps {
  product: SerializedProduct;
  sessionId?: string;
  channel?: string;
}

export function ProductPageClient({
  product,
  sessionId,
  channel,
}: ProductPageClientProps) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [placedOrder, setPlacedOrder] = useState<{
    orderId: string;
    totalAmount: number;
  } | null>(null);

  const handleSelectVariant = (category: string, value: string) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-violet-500/20">
      {/* Background Subtle Gradient Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-40 dark:opacity-25">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-600/30 blur-[128px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-blue-600/25 blur-[128px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Brand Bar */}
        <header className="mb-8 flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-600 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              D
            </div>
            <span className="font-extrabold tracking-tight text-foreground text-sm sm:text-base">
              Driplare Store
            </span>
          </div>

          <div className="rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            Chat-Native Checkout
          </div>
        </header>

        {placedOrder ? (
          <div className="mx-auto max-w-lg pt-4">
            <OrderConfirmation
              orderId={placedOrder.orderId}
              productName={product.name}
              totalAmount={placedOrder.totalAmount}
              sessionId={sessionId}
              onReset={() => setPlacedOrder(null)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left: Product Hero & Gallery */}
            <div className="lg:col-span-6 space-y-6">
              <ProductHero
                name={product.name}
                price={product.price}
                currency={product.currency}
                stock={product.stock}
                description={product.description}
                imageUrl={product.imageUrl}
                imageUrls={product.imageUrls}
              />

              <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <VariantSelector
                  variants={product.variants}
                  selectedVariants={selectedVariants}
                  onSelectVariant={handleSelectVariant}
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  maxStock={product.stock}
                />
              </div>
            </div>

            {/* Right: Order Form */}
            <div className="lg:col-span-6 lg:sticky lg:top-8">
              <OrderForm
                productId={product.productId}
                productName={product.name}
                unitPrice={product.price ?? 0}
                quantity={quantity}
                selectedVariants={selectedVariants}
                sessionId={sessionId}
                channel={channel}
                onOrderPlaced={setPlacedOrder}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          Powered by Driplare AI • Instant Chat & Social Commerce
        </footer>
      </div>
    </div>
  );
}
