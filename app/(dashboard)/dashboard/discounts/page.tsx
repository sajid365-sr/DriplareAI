"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgePercent, CalendarDays, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateCouponModal, type Coupon } from "@/components/discounts/CreateCouponModal";
import { useWorkspace } from "@/components/workspace-provider";

function formatDiscount(coupon: Coupon, translate: (key: string) => string, currency: string) {
  if (coupon.type === "percentage") return `${coupon.value}%`;
  if (coupon.type === "free_shipping") return translate("free");
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(coupon.value);
}

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function DiscountsPage() {
  const { t, i18n } = useTranslation("discounts");
  const { activeWorkspace } = useWorkspace();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const workspaceId = activeWorkspace?.workspaceId ?? "";
  const loading = Boolean(workspaceId) && loadedWorkspaceId !== workspaceId;
  const visibleCoupons = loadedWorkspaceId === workspaceId ? coupons : [];
  const activeCount = visibleCoupons.filter((coupon) => coupon.active).length;

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const loadCoupons = async () => {
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/coupons`, { cache: "no-store" });
        const data: unknown = await response.json();
        const errorMessage = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : t("loadError");
        if (!response.ok) throw new Error(errorMessage);
        if (!cancelled) setCoupons(Array.isArray(data) ? data as Coupon[] : []);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("loadError"));
          setCoupons([]);
        }
      } finally {
        if (!cancelled) setLoadedWorkspaceId(workspaceId);
      }
    };
    void loadCoupons();
    return () => { cancelled = true; };
  }, [workspaceId, t]);

  const toggleCoupon = async (coupon: Coupon, active: boolean) => {
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/coupons/${encodeURIComponent(coupon.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("saveError"));
      setCoupons((current) => current.map((item) => item.id === coupon.id ? data as Coupon : item));
      toast.success(t(active ? "activated" : "deactivated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const deleteCoupon = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/coupons/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("deleteError"));
      setCoupons((current) => current.filter((coupon) => coupon.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (coupon: Coupon) => { setEditing(coupon); setModalOpen(true); };
  const handleSaved = (coupon: Coupon) => setCoupons((current) => current.some((item) => item.id === coupon.id) ? current.map((item) => item.id === coupon.id ? coupon : item) : [coupon, ...current]);
  const locale = i18n.language === "bn" ? "bn-BD" : "en-GB";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground md:text-2xl"><Tag className="h-5 w-5 text-primary" />{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate} disabled={!workspaceId} className="gap-2"><Plus className="h-4 w-4" />{t("create")}</Button>
      </motion.header>

      {!workspaceId ? <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t("noWorkspace")}</div> : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            {[
              { label: t("totalOffers"), value: visibleCoupons.length, icon: Tag },
              { label: t("activeOffers"), value: activeCount, icon: BadgePercent },
            ].map(({ label, value, icon: Icon }, index) => <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.25 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span></div>
              <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            </motion.div>)}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("activeOffers")}</h2>
              <Badge variant="secondary">{visibleCoupons.length}</Badge>
            </div>
            {loading ? <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("loading")}</div> : visibleCoupons.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BadgePercent className="h-6 w-6" /></span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{t("emptyTitle")}</h3>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{t("emptyDescription")}</p>
              <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" />{t("create")}</Button>
            </div> : <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>{t("code")}</TableHead><TableHead>{t("discount")}</TableHead><TableHead>{t("minOrderShort")}</TableHead><TableHead>{t("period")}</TableHead><TableHead>{t("status")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead></TableRow></TableHeader>
                <TableBody>{visibleCoupons.map((coupon) => {
                  const startsAt = formatDate(coupon.startsAt, locale);
                  const expiresAt = formatDate(coupon.expiresAt, locale);
                  const period = [startsAt && `${t("starts", { date: startsAt })}`, expiresAt && `${t("ends", { date: expiresAt })}`].filter(Boolean).join(" · ") || t("allDates");
                  return <TableRow key={coupon.id}>
                    <TableCell><div className="font-mono font-semibold text-foreground">{coupon.code}</div>{coupon.title && <div className="mt-0.5 text-xs text-muted-foreground">{coupon.title}</div>}</TableCell>
                    <TableCell><div className="font-medium text-foreground">{formatDiscount(coupon, (key) => t(key), "BDT")}</div><div className="text-xs text-muted-foreground">{t(coupon.type === "percentage" ? "percentage" : coupon.type === "fixed" ? "fixed" : "freeShipping")}</div></TableCell>
                    <TableCell className="text-muted-foreground">{coupon.minOrder > 0 ? new Intl.NumberFormat(locale, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(coupon.minOrder) : t("noMinimum")}</TableCell>
                    <TableCell className="min-w-48 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{period}</span></TableCell>
                    <TableCell><div className="flex items-center gap-2"><Switch checked={coupon.active} onCheckedChange={(checked) => void toggleCoupon(coupon, checked)} aria-label={`${t("status")} ${coupon.code}`} /><Badge variant={coupon.active ? "default" : "secondary"}>{t(coupon.active ? "active" : "inactive")}</Badge></div></TableCell>
                    <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(coupon)} aria-label={`${t("edit")} ${coupon.code}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(coupon)} aria-label={`${t("delete")} ${coupon.code}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            </div>}
          </section>
        </>
      )}

      <AnimatePresence>{modalOpen && workspaceId && <CreateCouponModal workspaceId={workspaceId} onClose={() => setModalOpen(false)} onSaved={handleSaved} initial={editing ?? undefined} />}</AnimatePresence>
      <AnimatePresence>{deleteTarget && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && setDeleteTarget(null)}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <h2 className="text-base font-semibold text-foreground">{t("confirmDeleteTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("confirmDeleteBody", { code: deleteTarget.code })}</p>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("cancel")}</Button><Button variant="destructive" onClick={() => void deleteCoupon()} disabled={deleting} className="gap-2">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}{t("delete")}</Button></div>
        </motion.div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}
