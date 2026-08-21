import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { blogPostUpdateSchema } from "@/lib/domain/admin-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;

    const post = await db.blogPost.findUnique({
      where: { id },
      include: { author: { select: { name: true, email: true } } },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("[ADMIN_BLOG_ID_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = blogPostUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const existing = await db.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const { slug, locale, status, ...rest } = parsed.data;
    const nextLocale = locale ?? existing.locale;
    const nextSlug = slug ?? existing.slug;

    if (slug !== undefined || locale !== undefined) {
      const duplicate = await db.blogPost.findFirst({
        where: {
          slug: nextSlug,
          locale: nextLocale,
          NOT: { id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Slug already exists for this locale" },
          { status: 409 }
        );
      }
    }

    const nextStatus = status ?? existing.status;
    const publishedAt =
      nextStatus === "published" && !existing.publishedAt
        ? new Date()
        : existing.publishedAt;

    const post = await db.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(slug !== undefined ? { slug } : {}),
        ...(locale !== undefined ? { locale } : {}),
        ...(status !== undefined ? { status } : {}),
        publishedAt,
      },
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("[ADMIN_BLOG_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;

    await db.blogPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_BLOG_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
