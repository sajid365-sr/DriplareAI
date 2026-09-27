import "server-only";

import { cookies } from "next/headers";
import { db } from "@/lib/core/db";

/** Resolve public blog locale from region cookie (BD → bn, Global → en) */
export async function getBlogLocale(): Promise<"en" | "bn"> {
  const cookieStore = await cookies();
  const region = cookieStore.get("driplare_region")?.value;
  return region === "global" ? "en" : "bn";
}

export async function getPublishedPosts(locale: string) {
  return db.blogPost.findMany({
    where: { status: "published", locale },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      category: true,
      tags: true,
      publishedAt: true,
      locale: true,
      author: { select: { name: true } },
    },
  });
}

export async function getPublishedPostBySlug(slug: string, locale: string) {
  return db.blogPost.findFirst({
    where: { slug, locale, status: "published" },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      publishedAt: true,
      locale: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });
}
