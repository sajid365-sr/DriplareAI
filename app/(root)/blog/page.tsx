import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBlogLocale, getPublishedPosts } from "@/lib/blog/queries";
import { htmlExcerpt } from "@/lib/blog/utils";
import { Badge } from "@/components/ui/badge";
import en from "@/public/locales/en/blog.json";
import bn from "@/public/locales/bn/blog.json";

export const metadata = {
  title: "Blog | Driplare AI",
};

export default async function BlogListingPage() {
  const locale = await getBlogLocale();
  const t = locale === "bn" ? bn : en;
  const posts = await getPublishedPosts(locale);

  return (
    <div className="bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t.backHome}
        </Link>

        <div className="mt-8 mb-10">
          <h1 className="text-4xl font-bold tracking-tighter text-brand-gradient">{t.title}</h1>
          <p className="mt-3 text-muted-foreground">{t.subtitle}</p>
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{t.empty}</p>
        ) : (
          <ul className="space-y-6">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-primary/10 bg-card/50 p-6 transition-all hover:border-primary/25 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {post.locale}
                    </Badge>
                    {post.publishedAt && (
                      <time className="text-xs text-muted-foreground">
                        {new Date(post.publishedAt).toLocaleDateString(
                          locale === "bn" ? "bn-BD" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        )}
                      </time>
                    )}
                  </div>
                  <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {htmlExcerpt(post.content)}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">{t.readMore} →</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
