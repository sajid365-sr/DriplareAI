import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getBlogLocale, getPublishedPostBySlug } from "@/lib/blog/queries";
import { htmlExcerpt } from "@/lib/blog/utils";
import { BlogArticle } from "@/components/blog/BlogArticle";
import en from "@/public/locales/en/blog.json";
import bn from "@/public/locales/bn/blog.json";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { lang } = await searchParams;
  const locale = lang === "en" || lang === "bn" ? lang : await getBlogLocale();
  const post = await getPublishedPostBySlug(slug, locale);

  if (!post) return { title: "Blog | Driplare AI" };

  return {
    title: `${post.title} | Driplare AI Blog`,
    description: htmlExcerpt(post.content, 155),
  };
}

export default async function BlogPostPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const locale = lang === "en" || lang === "bn" ? lang : await getBlogLocale();
  const t = locale === "bn" ? bn : en;

  const post = await getPublishedPostBySlug(slug, locale);
  if (!post) notFound();

  return (
    <div className="bg-background">
      <article className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t.backToBlog}
        </Link>

        <header className="mt-8 mb-8 border-b border-border/60 pb-8">
          {post.publishedAt && (
            <time className="text-sm text-muted-foreground">
              {new Date(post.publishedAt).toLocaleDateString(
                locale === "bn" ? "bn-BD" : "en-US",
                { year: "numeric", month: "long", day: "numeric" }
              )}
            </time>
          )}
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t.byAuthor} {post.author.name}
          </p>
        </header>

        <BlogArticle html={post.content} />
      </article>
    </div>
  );
}
