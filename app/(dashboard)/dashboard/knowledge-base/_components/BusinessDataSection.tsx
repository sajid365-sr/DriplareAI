"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BadgePercent, Building2, Check, ClipboardList, Loader2, Package, Save, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/core/workspace";
import { BusinessProfileAssistant, type BusinessProfileFields } from "./BusinessProfileAssistant";
import { DeliveryPolicyEditor } from "./DeliveryPolicyEditor";
import type { WorkspaceDeliveryPolicy } from "@/lib/domain/workspace-business-profile";

type BusinessProfile = BusinessProfileFields & { deliveryPolicy: WorkspaceDeliveryPolicy };
type BusinessData = {
  profile: BusinessProfile;
  counts: { products: number; activeOffers: number; totalOffers: number; orders: number; records: number; forms: number; sharedKnowledge: number; businessRules: number; agents: number; connectedChannels: number };
  courier: { configured: boolean; providers: string[] };
  canEdit: boolean;
};
type BusinessDataSectionProps = { workspace: Workspace | null };

const EMPTY_DELIVERY_POLICY: WorkspaceDeliveryPolicy = { currency: "BDT", zones: [], freeDeliveryMinimum: null };
const EMPTY_PROFILE: BusinessProfile = { description: "", phone: "", email: "", website: "", address: "", openingHours: "", paymentMethods: "", deliveryDetails: "", deliveryPolicy: EMPTY_DELIVERY_POLICY };

export function BusinessDataSection({ workspace }: BusinessDataSectionProps) {
  const { t } = useTranslation("knowledge-base");
  const [data, setData] = useState<BusinessData | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const loading = Boolean(workspace?.workspaceId) && loadedWorkspaceId !== workspace?.workspaceId;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!workspace?.workspaceId) {
      return;
    }
    fetch(`/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/business-data`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("businessData.loadError"));
        if (cancelled) return;
        setData(result as BusinessData);
        const savedProfile = (result.profile ?? {}) as Partial<BusinessProfile>;
        setProfile({
          ...EMPTY_PROFILE,
          ...savedProfile,
          deliveryPolicy: savedProfile.deliveryPolicy ?? EMPTY_DELIVERY_POLICY,
        });
        setSaved(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setData(null);
        setProfile(EMPTY_PROFILE);
        toast.error(error instanceof Error ? error.message : t("businessData.loadError"));
      })
      .finally(() => { if (!cancelled) setLoadedWorkspaceId(workspace.workspaceId); });
    return () => { cancelled = true; };
  }, [workspace?.workspaceId, t]);

  const updateProfile = (key: keyof BusinessProfileFields, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const applySuggestions = (suggestions: BusinessProfileFields) => {
    setProfile((current) => {
      const next = { ...current };
      for (const key of Object.keys(suggestions) as Array<keyof BusinessProfileFields>) {
        if (!next[key].trim() && suggestions[key].trim()) next[key] = suggestions[key];
      }
      return next;
    });
    setSaved(false);
    toast.success(t("businessData.assistant.applied", "Suggestions added to empty profile fields. Review and save them when ready."));
  };

  const saveProfile = async () => {
    if (!workspace?.workspaceId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/business-data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("businessData.saveError"));
      const savedProfile = (result.profile ?? {}) as Partial<BusinessProfile>;
      setProfile({
        ...EMPTY_PROFILE,
        ...savedProfile,
        deliveryPolicy: savedProfile.deliveryPolicy ?? EMPTY_DELIVERY_POLICY,
      });
      setSaved(true);
      toast.success(t("businessData.saved", "Business profile saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("businessData.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const category = workspace?.category.toLowerCase() ?? "";
  const isEcommerce = category.includes("ecommerce") || category.includes("e-commerce");
  const modules = [
    ...(isEcommerce ? [
      { key: "products", href: "/dashboard/products", icon: Package, count: data?.counts.products ?? 0 },
      { key: "orders", href: "/dashboard/orders", icon: ShoppingBag, count: data?.counts.orders ?? 0 },
      { key: "delivery", href: "/dashboard/couriers", icon: Truck, count: data?.courier.providers.length ?? 0 },
      { key: "offers", href: "/dashboard/discounts", icon: BadgePercent, count: data?.counts.activeOffers ?? 0 },
    ] : []),
    { key: "records", href: "/dashboard/records", icon: ClipboardList, count: data?.counts.records ?? 0 },
  ];
  const profileFields: Array<{ key: keyof BusinessProfileFields; input: "input" | "textarea"; wide?: boolean }> = [
    { key: "description", input: "textarea", wide: true },
    { key: "phone", input: "input" },
    { key: "email", input: "input" },
    { key: "website", input: "input" },
    { key: "address", input: "input", wide: true },
    { key: "openingHours", input: "input" },
    { key: "paymentMethods", input: "input" },
    { key: "deliveryDetails", input: "textarea", wide: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("businessData.title", "Business Data")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessData.description", "Manage core business facts once. Your AI Agents read current products, orders, offers, delivery connections, and records from their existing modules.")}</p>
          {workspace && <p className="mt-2 text-xs font-medium text-foreground">{t("businessData.activeBusiness", { name: workspace.name, defaultValue: "Active business: {{name}}" })}</p>}
        </div>
      </div>

      <section id="business-profile" className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("businessData.profile.title", "Business profile")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("businessData.profile.description", "Add basic facts once so every Agent can answer consistently.")}</p>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
            <Button size="sm" onClick={saveProfile} disabled={saving || saved || !data?.canEdit} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? t("businessData.saving", "Saving…") : saved ? t("businessData.saved", "Saved") : t("businessData.profile.save", "Save profile")}
            </Button>
          )}
        </div>
        {!loading && <BusinessProfileAssistant workspaceId={workspace?.workspaceId ?? ""} canEdit={Boolean(data?.canEdit)} onApply={applySuggestions} />}
        {!loading && <DeliveryPolicyEditor
          policy={profile.deliveryPolicy}
          disabled={!data?.canEdit}
          onChange={(deliveryPolicy) => {
            setProfile((current) => ({ ...current, deliveryPolicy }));
            setSaved(false);
          }}
        />}
        {loading ? <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted/50" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {profileFields.map(({ key, input, wide }) => (
            <label key={key} className={`space-y-1.5 text-xs font-medium text-foreground ${wide ? "sm:col-span-2" : ""}`}>
              {t(`businessData.profile.fields.${key}.label`)}
              {input === "textarea" ? <textarea value={profile[key]} onChange={(event) => updateProfile(key, event.target.value)} disabled={!data?.canEdit} rows={3} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" /> : <input value={profile[key]} onChange={(event) => updateProfile(key, event.target.value)} disabled={!data?.canEdit} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />}
            </label>
          ))}
        </div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ key, href, icon: Icon, count }) => (
          <Link key={key} href={href} className="group flex min-h-32 items-start gap-3 rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-foreground">{t(`businessData.modules.${key}.title`)}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span></span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(`businessData.modules.${key}.description`)}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">{t("businessData.manage", "Manage")}<ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
            </span>
          </Link>
        ))}
      </div>
      {isEcommerce && <p className="text-xs leading-5 text-muted-foreground">{data?.courier.providers.length ? t("businessData.deliveryConnected", { providers: data.courier.providers.join(", "), defaultValue: "Connected courier providers: {{providers}}" }) : t("businessData.deliveryNote", "Delivery charges and customer-facing delivery policy belong in Business Rules; courier credentials stay in Courier Settings.")}</p>}
    </div>
  );
}
