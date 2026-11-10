"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BadgePercent, Building2, Check, ClipboardList, Loader2, Package, Plus, Save, ShoppingBag, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/core/workspace";
import { BusinessProfileAssistant, type BusinessProfileFields } from "./BusinessProfileAssistant";
import { DeliveryPolicyEditor } from "./DeliveryPolicyEditor";
import {
  getWorkspaceBusinessProfileFields,
  WorkspaceBusinessProfileCustomFieldsSchema,
  type WorkspaceBusinessProfileCustomField,
  type WorkspaceBusinessProfileFieldType,
  type WorkspaceDeliveryPolicy,
} from "@/lib/domain/workspace-business-profile";

type BusinessProfile = BusinessProfileFields & {
  deliveryPolicy: WorkspaceDeliveryPolicy;
  categoryFields: Record<string, string>;
  customFields: WorkspaceBusinessProfileCustomField[];
};
type BusinessData = {
  profile: BusinessProfile;
  counts: { products: number; activeOffers: number; totalOffers: number; orders: number; records: number; forms: number; sharedKnowledge: number; businessRules: number; agents: number; connectedChannels: number };
  courier: { configured: boolean; providers: string[] };
  canEdit: boolean;
};
type BusinessDataSectionProps = { workspace: Workspace | null; showIntro?: boolean };

const EMPTY_DELIVERY_POLICY: WorkspaceDeliveryPolicy = { currency: "BDT", zones: [], freeDeliveryMinimum: null };
const EMPTY_PROFILE: BusinessProfile = {
  description: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  openingHours: "",
  paymentMethods: "",
  deliveryDetails: "",
  deliveryPolicy: EMPTY_DELIVERY_POLICY,
  categoryFields: {},
  customFields: [],
};

export function BusinessDataSection({ workspace, showIntro = true }: BusinessDataSectionProps) {
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
          categoryFields: savedProfile.categoryFields ?? {},
          customFields: savedProfile.customFields ?? [],
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

  const updateCategoryField = (key: string, value: string) => {
    setProfile((current) => ({ ...current, categoryFields: { ...current.categoryFields, [key]: value } }));
    setSaved(false);
  };

  const updateCustomField = (id: string, updates: Partial<WorkspaceBusinessProfileCustomField>) => {
    setProfile((current) => ({
      ...current,
      customFields: current.customFields.map((field) => field.id === id ? { ...field, ...updates } : field),
    }));
    setSaved(false);
  };

  const addCustomField = () => {
    if (profile.customFields.length >= 20) {
      toast.error(t("businessData.profile.customFields.limit"));
      return;
    }
    setProfile((current) => ({
      ...current,
      customFields: [...current.customFields, { id: crypto.randomUUID(), label: "", type: "text", value: "" }],
    }));
    setSaved(false);
  };

  const removeCustomField = (id: string) => {
    setProfile((current) => ({ ...current, customFields: current.customFields.filter((field) => field.id !== id) }));
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
    const customFields = WorkspaceBusinessProfileCustomFieldsSchema.safeParse(profile.customFields);
    if (!customFields.success) {
      toast.error(t("businessData.profile.customFields.validationError"));
      return;
    }
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
        categoryFields: savedProfile.categoryFields ?? {},
        customFields: savedProfile.customFields ?? [],
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
  const categoryProfileFields = getWorkspaceBusinessProfileFields(workspace?.category);
  const customFieldTypes: WorkspaceBusinessProfileFieldType[] = ["text", "textarea", "number", "url", "boolean"];

  return (
    <div className="space-y-5">
      {showIntro && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t("businessData.title", "Business Data")}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessData.description", "Manage core business facts once. Your AI Agents read current products, orders, offers, delivery connections, and records from their existing modules.")}</p>
            {workspace && <p className="mt-2 text-xs font-medium text-foreground">{t("businessData.activeBusiness", { name: workspace.name, defaultValue: "Active business: {{name}}" })}</p>}
          </div>
        </div>
      )}

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
              {input === "textarea"
                ? <textarea value={profile[key]} onChange={(event) => updateProfile(key, event.target.value)} disabled={!data?.canEdit} rows={3} placeholder={t(`businessData.profile.fields.${key}.placeholder`)} aria-describedby={`business-profile-${key}-hint`} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                : <input value={profile[key]} onChange={(event) => updateProfile(key, event.target.value)} disabled={!data?.canEdit} placeholder={t(`businessData.profile.fields.${key}.placeholder`)} aria-describedby={`business-profile-${key}-hint`} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />}
              <span id={`business-profile-${key}-hint`} className="block text-[11px] leading-4 text-muted-foreground">{t(`businessData.profile.fields.${key}.hint`)}</span>
            </label>
          ))}
        </div>}
        {!loading && categoryProfileFields.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">{t("businessData.profile.categoryFields.title")}</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessData.profile.categoryFields.description")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {categoryProfileFields.map((field) => {
                const key = `businessData.profile.categoryFields.${field.key}`;
                return (
                  <label key={field.key} className="space-y-1.5 text-xs font-medium text-foreground">
                    {t(`${key}.label`)}
                    {field.type === "textarea"
                      ? <textarea value={profile.categoryFields[field.key] ?? ""} onChange={(event) => updateCategoryField(field.key, event.target.value)} disabled={!data?.canEdit} rows={3} placeholder={t(`${key}.placeholder`)} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                      : <input value={profile.categoryFields[field.key] ?? ""} onChange={(event) => updateCategoryField(field.key, event.target.value)} disabled={!data?.canEdit} placeholder={t(`${key}.placeholder`)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />}
                    <span className="block text-[11px] leading-4 text-muted-foreground">{t(`${key}.hint`)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {!loading && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{t("businessData.profile.customFields.title")}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessData.profile.customFields.description")}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addCustomField} disabled={!data?.canEdit || profile.customFields.length >= 20} className="gap-2">
                <Plus className="h-4 w-4" />{t("businessData.profile.customFields.add")}
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {profile.customFields.map((field, index) => {
                const valueId = `business-custom-field-${field.id}`;
                return (
                  <div key={field.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto] sm:items-end">
                    <label className="space-y-1.5 text-xs font-medium text-foreground">
                      {t("businessData.profile.customFields.name", { number: index + 1 })}
                      <input value={field.label} onChange={(event) => updateCustomField(field.id, { label: event.target.value })} disabled={!data?.canEdit} maxLength={60} placeholder={t("businessData.profile.customFields.namePlaceholder")} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-foreground">
                      {t("businessData.profile.customFields.type")}
                      <select value={field.type} onChange={(event) => {
                        const type = customFieldTypes.find((option) => option === event.target.value);
                        if (type) updateCustomField(field.id, { type, value: "" });
                      }} disabled={!data?.canEdit} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
                        {customFieldTypes.map((type) => <option key={type} value={type}>{t(`businessData.profile.customFields.types.${type}`)}</option>)}
                      </select>
                    </label>
                    <label htmlFor={valueId} className="space-y-1.5 text-xs font-medium text-foreground">
                      {t("businessData.profile.customFields.value")}
                      {field.type === "textarea"
                        ? <textarea id={valueId} value={field.value} onChange={(event) => updateCustomField(field.id, { value: event.target.value })} disabled={!data?.canEdit} rows={2} maxLength={2000} placeholder={t("businessData.profile.customFields.valuePlaceholder")} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                        : field.type === "boolean"
                          ? <select id={valueId} value={field.value} onChange={(event) => updateCustomField(field.id, { value: event.target.value })} disabled={!data?.canEdit} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"><option value="">{t("businessData.profile.customFields.chooseValue")}</option><option value="true">{t("businessData.profile.customFields.yes")}</option><option value="false">{t("businessData.profile.customFields.no")}</option></select>
                          : <input id={valueId} type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"} value={field.value} onChange={(event) => updateCustomField(field.id, { value: event.target.value })} disabled={!data?.canEdit} maxLength={2000} placeholder={t("businessData.profile.customFields.valuePlaceholder")} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />}
                    </label>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("businessData.profile.customFields.remove")} onClick={() => removeCustomField(field.id)} disabled={!data?.canEdit} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
