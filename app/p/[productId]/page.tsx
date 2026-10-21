import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/core/db";
import { ProductPageClient, type SerializedProduct } from "./_components/ProductPageClient";

interface PageProps {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ session?: string; channel?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await db.product.findUnique({
    where: { productId },
    select: { name: true, description: true, imageUrl: true, price: true, currency: true },
  });

  if (!product) {
    return {
      title: "Product Not Found | Driplare AI",
    };
  }

  const priceStr = product.price ? ` - ৳${product.price.toLocaleString()}` : "";

  return {
    title: `${product.name}${priceStr} | Order Now`,
    description: product.description || `Order ${product.name} directly via instant chat checkout.`,
    openGraph: {
      title: `${product.name}${priceStr}`,
      description: product.description || undefined,
      images: product.imageUrl ? [{ url: product.imageUrl }] : [],
    },
  };
}

export default async function PublicProductPage({
  params,
  searchParams,
}: PageProps) {
  const { productId } = await params;
  const { session, channel } = await searchParams;

  const product = await db.product.findUnique({
    where: { productId },
  });

  if (!product || !product.isActive) {
    notFound();
  }

  // Parse variants cleanly if stored as JSON
  let parsedVariants: Record<string, string[]> | null = null;
  if (product.variants && typeof product.variants === "object") {
    parsedVariants = product.variants as Record<string, string[]>;
  }

  const serialized: SerializedProduct = {
    productId: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency || "BDT",
    stock: product.stock ?? 0,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls || [],
    variants: parsedVariants,
  };

  return (
    <ProductPageClient
      product={serialized}
      sessionId={session}
      channel={channel}
    />
  );
}
