"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PlatformFormDialog, type PlatformRow } from "@/components/admin/PlatformFormDialog";

type PlatformsResponse = {
  platforms: PlatformRow[];
  stats: { total: number; active: number; comingSoon: number };
};

export default function AdminPlatformsPage() {
  const { t } = useTranslation("admin");
  const [data, setData] = useState<PlatformsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformRow | null>(null);

  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/platforms");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      toast.error(t("platforms.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (platform: PlatformRow) => {
    setEditing(platform);
    setDialogOpen(true);
  };

  const deletePlatform = async (platformId: string) => {
    if (!confirm(t("platforms.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/admin/platforms/${platformId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("platforms.deleted"));
      fetchPlatforms();
    } catch {
      toast.error(t("platforms.deleteError"));
    }
  };

  const statCards = [
    { label: t("platforms.stats.total"), value: data?.stats.total ?? 0 },
    { label: t("platforms.stats.active"), value: data?.stats.active ?? 0 },
    { label: t("platforms.stats.comingSoon"), value: data?.stats.comingSoon ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("platforms.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("platforms.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="rounded-full bg-brand-gradient">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("platforms.add")}
          </Button>
          <Button variant="outline" size="icon" onClick={fetchPlatforms} className="rounded-xl">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        {statCards.map(({ label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-primary/10 bg-card/60 p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </motion.div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/40">
        {loading && !data ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("platforms.loading")}</div>
        ) : !data?.platforms.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("platforms.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.platforms.map((platform) => (
              <li
                key={platform.platformId}
                className="flex items-start gap-4 px-4 py-4 md:px-6"
              >
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                  style={{ backgroundColor: platform.color }}
                >
                  {platform.iconKey.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{platform.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {platform.platformId}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {platform.category}
                    </Badge>
                    {!platform.isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        inactive
                      </Badge>
                    )}
                    {platform.isComingSoon && (
                      <Badge className="text-[10px]">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {platform.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    order: {platform.order} · icon: {platform.iconKey}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => openEdit(platform)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-destructive hover:text-destructive"
                    onClick={() => deletePlatform(platform.platformId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PlatformFormDialog
        open={dialogOpen}
        platform={editing}
        onOpenChange={setDialogOpen}
        onSaved={fetchPlatforms}
      />
    </div>
  );
}
