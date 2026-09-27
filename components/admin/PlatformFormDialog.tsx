"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_CATEGORIES } from "@/lib/domain/admin-schemas";

export type PlatformRow = {
  platformId: string;
  name: string;
  description: string;
  iconKey: string;
  color: string;
  isComingSoon: boolean;
  isActive: boolean;
  category: string;
  order: number;
};

type PlatformFormDialogProps = {
  open: boolean;
  platform: PlatformRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const EMPTY_FORM = {
  platformId: "",
  name: "",
  description: "",
  iconKey: "",
  color: "#6d28d9",
  isComingSoon: false,
  isActive: true,
  category: "social",
  order: 0,
};

export function PlatformFormDialog({
  open,
  platform,
  onOpenChange,
  onSaved,
}: PlatformFormDialogProps) {
  const { t } = useTranslation("admin");
  const isEdit = !!platform;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (platform) {
      setForm({
        platformId: platform.platformId,
        name: platform.name,
        description: platform.description,
        iconKey: platform.iconKey,
        color: platform.color,
        isComingSoon: platform.isComingSoon,
        isActive: platform.isActive,
        category: platform.category,
        order: platform.order,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [platform, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/platforms/${platform!.platformId}`
        : "/api/admin/platforms";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? {
            name: form.name,
            description: form.description,
            iconKey: form.iconKey,
            color: form.color,
            isComingSoon: form.isComingSoon,
            isActive: form.isActive,
            category: form.category,
            order: form.order,
          }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      toast.success(isEdit ? t("platforms.updated") : t("platforms.created"));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("platforms.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("platforms.editTitle") : t("platforms.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!isEdit && (
            <div className="grid gap-2">
              <Label>{t("platforms.fields.platformId")}</Label>
              <Input
                value={form.platformId}
                onChange={(e) => setForm((f) => ({ ...f, platformId: e.target.value.toLowerCase() }))}
                placeholder="facebook"
                className="rounded-xl font-mono text-sm"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>{t("platforms.fields.name")}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("platforms.fields.description")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("platforms.fields.iconKey")}</Label>
              <Input
                value={form.iconKey}
                onChange={(e) => setForm((f) => ({ ...f, iconKey: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("platforms.fields.color")}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-10 w-12 rounded-lg p-1"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="rounded-xl font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("platforms.fields.category")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("platforms.fields.order")}</Label>
              <Input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))
                }
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <Label htmlFor="isActive">{t("platforms.fields.isActive")}</Label>
            <Switch
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <Label htmlFor="isComingSoon">{t("platforms.fields.isComingSoon")}</Label>
            <Switch
              id="isComingSoon"
              checked={form.isComingSoon}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isComingSoon: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            {t("platforms.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-full bg-brand-gradient">
            {saving ? t("platforms.saving") : t("platforms.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
