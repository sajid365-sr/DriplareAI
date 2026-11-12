"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Hash, Loader2, Tag, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DiscountType = "percentage" | "fixed" | "free_shipping";
export interface Coupon {
  id: string;
  code: string;
  title: string | null;
  type: DiscountType;
  value: number;
  minOrder: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
}

interface CreateCouponModalProps {
  workspaceId: string;
  onClose: () => void;
  onSaved: (coupon: Coupon) => void;
  initial?: Coupon;
}

function toDateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function CreateCouponModal({ workspaceId, onClose, onSaved, initial }: CreateCouponModalProps) {
  const { t } = useTranslation("discounts");
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    title: initial?.title ?? "",
    type: initial?.type ?? ("percentage" as DiscountType),
    value: initial && initial.type !== "free_shipping" ? String(initial.value) : "",
    minOrder: initial ? String(initial.minOrder) : "",
    startsAt: toDateInput(initial?.startsAt),
    expiresAt: toDateInput(initial?.expiresAt),
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = form.type === "free_shipping" ? 0 : Number(form.value);
    const minOrder = Number(form.minOrder || 0);
    if (!form.code.trim()) return toast.error(t("code") + " is required");
    if (!Number.isFinite(value) || value < 0) return toast.error(t("badValue"));
    if (!Number.isFinite(minOrder) || minOrder < 0) return toast.error(t("badValue"));

    const payload = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim() || null,
      type: form.type,
      value,
      minOrder,
      startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00.000Z`).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString() : null,
      active: initial?.active ?? true,
    };

    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/coupons${initial ? `/${encodeURIComponent(initial.id)}` : ""}`, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("saveError"));
      onSaved(data as Coupon);
      toast.success(t("saved"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15";
  const labelClass = "mb-1.5 block text-xs font-medium text-foreground";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="offer-modal-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="offer-modal-title" className="flex items-center gap-2 text-base font-semibold text-foreground"><Tag className="h-4 w-4 text-primary" />{t(isEdit ? "edit" : "create")}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={t("cancel")}><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="offer-code" className={labelClass}>{t("code")}</label>
            <div className="relative"><Hash className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input id="offer-code" value={form.code} onChange={(event) => set("code", event.target.value)} required maxLength={40} autoCapitalize="characters" className={`${inputClass} pl-9 uppercase`} placeholder="EID2026" /></div>
          </div>

          <div>
            <label htmlFor="offer-title" className={labelClass}>{t("name")}</label>
            <input id="offer-title" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} className={inputClass} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelClass}>{t("type")}</label><Select value={form.type} onValueChange={(value) => set("type", value as DiscountType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">{t("percentage")}</SelectItem><SelectItem value="fixed">{t("fixed")}</SelectItem><SelectItem value="free_shipping">{t("freeShipping")}</SelectItem></SelectContent></Select></div>
            {form.type !== "free_shipping" && <div><label htmlFor="offer-value" className={labelClass}>{t("value")}</label><input id="offer-value" type="number" min="0" max={form.type === "percentage" ? 100 : undefined} step="0.01" required value={form.value} onChange={(event) => set("value", event.target.value)} className={inputClass} /></div>}
            <div><label htmlFor="offer-min-order" className={labelClass}>{t("minOrder")}</label><input id="offer-min-order" type="number" min="0" step="0.01" value={form.minOrder} onChange={(event) => set("minOrder", event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="offer-starts-at" className={labelClass}>{t("startsAt")}</label><input id="offer-starts-at" type="date" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="offer-expires-at" className={labelClass}>{t("expiresAt")}</label><input id="offer-expires-at" type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} className={inputClass} /></div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? t("saving") : t("save")}</Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
