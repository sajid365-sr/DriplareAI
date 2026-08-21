"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlogPostsTable, type BlogPostTableRow } from "@/components/admin/BlogPostsTable";
import { cn } from "@/lib/utils";

type BlogListResponse = {
  posts: BlogPostTableRow[];
  stats: { total: number };
};

export default function AdminBlogPage() {
  const { t } = useTranslation("admin");
  const [data, setData] = useState<BlogListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      toast.error(t("blog.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const posts = data?.posts ?? [];
  const total = data?.stats.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("blog.pageTitle")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPosts} className="rounded-lg">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button asChild className="rounded-lg bg-brand-gradient px-5 shadow-sm">
            <Link href="/admin/blog/new">
              <Plus className="mr-1.5 h-4 w-4" />
              {t("blog.createNewPost")}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">
            {t("blog.allPosts", { count: total })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-16 text-center text-sm text-muted-foreground">
              {t("blog.loading")}
            </div>
          ) : posts.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm text-muted-foreground">{t("blog.empty")}</p>
              <Button asChild className="mt-4 rounded-lg bg-brand-gradient">
                <Link href="/admin/blog/new">{t("blog.createNewPost")}</Link>
              </Button>
            </div>
          ) : (
            <BlogPostsTable posts={posts} onChanged={fetchPosts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
