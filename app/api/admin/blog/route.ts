import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { blogPostCreateSchema } from "@/lib/domain/admin-schemas";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const locale = url.searchParams.get("locale") ?? undefined;
    const search = url.searchParams.get("search")?.trim() ?? "";

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (locale && locale !== "all") where.locale = locale;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const posts = await db.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, email: true } } },
    });

    const stats = await db.blogPost.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        tags: post.tags ?? [],
        category: post.category ?? "General",
      })),
      stats: {
        draft: stats.find((s) => s.status === "draft")?._count.status ?? 0,
        published: stats.find((s) => s.status === "published")?._count.status ?? 0,
        archived: stats.find((s) => s.status === "archived")?._count.status ?? 0,
        total: stats.reduce((acc, s) => acc + s._count.status, 0),
      },
    });
  } catch (error) {
    console.error("[ADMIN_BLOG_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const parsed = blogPostCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, slug, content, category, tags, locale, status } = parsed.data;

    const duplicate = await db.blogPost.findUnique({
      where: { slug_locale: { slug, locale } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Slug already exists for this locale" },
        { status: 409 }
      );
    }

    const post = await db.blogPost.create({
      data: {
        title,
        slug,
        content,
        category,
        tags,
        locale,
        status,
        authorId: authResult.userId,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_BLOG_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
