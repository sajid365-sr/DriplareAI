"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Archive,
  BookOpen,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCategoryBadgeClass,
  getStatusBadgeClass,
  visibleTags,
} from "@/lib/blog/categories";
import { cn } from "@/lib/utils";

export type BlogPostTableRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags?: string[] | null;
  status: string;
  locale: string;
  createdAt: string;
};

type BlogPostsTableProps = {
  posts: BlogPostTableRow[];
  onChanged: () => void;
};

export function BlogPostsTable({ posts, onChanged }: BlogPostsTableProps) {
  const { t } = useTranslation("admin");

  const archivePost = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("Archive failed");
      toast.success(t("blog.archived"));
      onChanged();
    } catch {
      toast.error(t("blog.archiveError"));
    }
  };

  const deletePost = async (id: string, title: string) => {
    if (!confirm(t("blog.deleteConfirmNamed", { title }))) return;
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("blog.deleted"));
      onChanged();
    } catch {
      toast.error(t("blog.deleteError"));
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">{t("blog.table.title")}</TableHead>
          <TableHead>{t("blog.table.category")}</TableHead>
          <TableHead>{t("blog.table.status")}</TableHead>
          <TableHead>{t("blog.table.tags")}</TableHead>
          <TableHead>{t("blog.table.created")}</TableHead>
          <TableHead className="pr-4 text-right">{t("blog.table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => {
          const { shown, hidden } = visibleTags(post.tags);
          const category = post.category ?? "General";
          const viewUrl =
            post.status === "published"
              ? `/blog/${post.slug}?lang=${post.locale}`
              : null;

          return (
            <TableRow key={post.id}>
              <TableCell className="pl-4 font-medium">
                <div className="flex items-center gap-2.5 min-w-[200px]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="line-clamp-2">{post.title}</span>
                </div>
              </TableCell>

              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("rounded-full font-normal", getCategoryBadgeClass(category))}
                >
                  {category}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full capitalize font-normal",
                    getStatusBadgeClass(post.status)
                  )}
                >
                  {t(`blog.status.${post.status}`, post.status)}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                  {shown.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    shown.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="rounded-full text-[10px] font-normal"
                      >
                        {tag}
                      </Badge>
                    ))
                  )}
                  {hidden > 0 && (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      +{hidden}
                    </Badge>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-muted-foreground">
                {new Date(post.createdAt).toLocaleDateString("en-US")}
              </TableCell>

              <TableCell className="pr-4">
                <div className="flex items-center justify-end gap-0.5">
                  {viewUrl ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={viewUrl} target="_blank" title={t("blog.actions.view")}>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled
                      title={t("blog.actions.viewDisabled")}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground/40" />
                    </Button>
                  )}

                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      title={t("blog.actions.edit")}
                    >
                      <Pencil className="h-4 w-4 text-info" />
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={post.status === "archived"}
                    onClick={() => archivePost(post.id)}
                    title={t("blog.actions.archive")}
                  >
                    <Archive className="h-4 w-4 text-warning" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deletePost(post.id, post.title)}
                    title={t("blog.actions.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
