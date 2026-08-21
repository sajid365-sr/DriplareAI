"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink, Save, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TiptapEditor } from "@/components/admin/TiptapEditor";
import { slugifyTitle } from "@/lib/blog/utils";
import {
  BLOG_CATEGORIES,
  formatTagsInput,
  parseTagsInput,
} from "@/lib/blog/categories";
import { BLOG_LOCALES, BLOG_STATUSES } from "@/lib/domain/admin-schemas";

type BlogPostEditorProps = {
  postId?: string;
};

export function BlogPostEditor({ postId }: BlogPostEditorProps) {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const isEdit = !!postId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    content: "<p></p>",
    category: "General",
    tagsInput: "",
    locale: "en",
    status: "draft",
  });

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog/${postId}`);
      if (!res.ok) throw new Error("Not found");
      const { post } = await res.json();
      setForm({
        title: post.title,
        slug: post.slug,
        content: post.content || "<p></p>",
        category: post.category || "General",
        tagsInput: formatTagsInput(post.tags ?? []),
        locale: post.locale,
        status: post.status,
      });
      setSlugTouched(true);
    } catch {
      toast.error(t("blog.loadError"));
      router.push("/admin/blog");
    } finally {
      setLoading(false);
    }
  }, [postId, router, t]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugifyTitle(title),
    }));
  };

  const savePost = async (statusOverride?: string) => {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error(t("blog.validation"));
      return;
    }

    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      category: form.category,
      tags: parseTagsInput(form.tagsInput),
      locale: form.locale,
      status: statusOverride ?? form.status,
    };

    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/blog/${postId}` : "/api/admin/blog";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      const data = await res.json();
      toast.success(
        statusOverride === "published"
          ? t("blog.published")
          : isEdit
            ? t("blog.updated")
            : t("blog.created")
      );

      if (!isEdit && data.post?.id) {
        router.push(`/admin/blog/${data.post.id}/edit`);
      } else if (statusOverride) {
        setForm((f) => ({ ...f, status: statusOverride }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("blog.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!postId || !confirm(t("blog.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("blog.deleted"));
      router.push("/admin/blog");
    } catch {
      toast.error(t("blog.deleteError"));
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">{t("blog.loading")}</div>
    );
  }

  const previewUrl =
    form.status === "published"
      ? `/blog/${form.slug}?lang=${form.locale}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-lg">
            <Link href="/admin/blog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? t("blog.editPageTitle") : t("blog.createPageTitle")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {previewUrl && (
            <Button variant="outline" size="sm" asChild className="rounded-lg">
              <Link href={previewUrl} target="_blank">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t("blog.preview")}
              </Link>
            </Button>
          )}
          {isEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="rounded-lg text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("blog.delete")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">{t("blog.sections.details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-2">
                <Label>{t("blog.fields.title")}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={t("blog.fields.titlePlaceholder")}
                  className="rounded-lg h-11 text-base"
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("blog.fields.category")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger className="rounded-lg h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t("blog.fields.tags")}</Label>
                <Input
                  value={form.tagsInput}
                  onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
                  placeholder={t("blog.fields.tagsPlaceholder")}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">{t("blog.fields.tagsHint")}</p>
              </div>

              <div className="grid gap-2">
                <Label>{t("blog.fields.slug")}</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                  }}
                  className="rounded-lg font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">{t("blog.fields.content")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <TiptapEditor
                content={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                placeholder={t("blog.fields.contentPlaceholder")}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">{t("blog.sections.publishing")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                <Label>{t("blog.fields.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`blog.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t("blog.fields.locale")}</Label>
                <Select
                  value={form.locale}
                  onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_LOCALES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l === "en" ? "English" : "বাংলা"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => savePost("published")}
                  disabled={saving}
                  className="w-full rounded-lg bg-brand-gradient"
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  {t("blog.publish")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => savePost("draft")}
                  disabled={saving}
                  className="w-full rounded-lg"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {t("blog.saveDraft")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => savePost()}
                  disabled={saving}
                  className="w-full rounded-lg"
                >
                  {saving ? t("blog.saving") : t("blog.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-muted/20 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("blog.editorHint")}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
