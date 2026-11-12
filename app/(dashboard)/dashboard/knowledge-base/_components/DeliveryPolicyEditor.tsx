"use client";

import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeliveryZone, WorkspaceDeliveryPolicy } from "@/lib/domain/workspace-business-profile";

type DeliveryPolicyEditorProps = {
  policy: WorkspaceDeliveryPolicy;
  onChange: (policy: WorkspaceDeliveryPolicy) => void;
  disabled?: boolean;
};

export function DeliveryPolicyEditor({ policy, onChange, disabled = false }: DeliveryPolicyEditorProps) {
  const { t } = useTranslation("knowledge-base");

  const updateZone = (id: string, patch: Partial<DeliveryZone>) => {
    onChange({ ...policy, zones: policy.zones.map((zone) => zone.id === id ? { ...zone, ...patch } : zone) });
  };

  const addZone = () => {
    const zone: DeliveryZone = {
      id: crypto.randomUUID(),
      name: "",
      areas: [],
      charge: 0,
      fastestDays: 1,
      slowestDays: 2,
    };
    onChange({ ...policy, zones: [...policy.zones, zone] });
  };

  return (
    <section className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t("businessData.deliveryPolicy.title", "Delivery areas and charges")}</h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{t("businessData.deliveryPolicy.description", "Add exact area names customers use. AI will quote these saved charges, and order creation checks the confirmed fee against the matching area.")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addZone} disabled={disabled || policy.zones.length >= 20} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t("businessData.deliveryPolicy.addZone", "Add delivery area")}
        </Button>
      </div>

      {policy.zones.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{t("businessData.deliveryPolicy.empty", "No delivery areas configured. Without them, the AI should confirm delivery charges with your team.")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {policy.zones.map((zone, index) => (
            <div key={zone.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-7">
              <label className="space-y-1 text-xs font-medium text-foreground xl:col-span-2">
                {t("businessData.deliveryPolicy.areaName", { index: index + 1, defaultValue: "Area group {{index}}" })}
                <input value={zone.name} onChange={(event) => updateZone(zone.id, { name: event.target.value })} disabled={disabled} placeholder={t("businessData.deliveryPolicy.areaNamePlaceholder", "Inside Dhaka")} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground xl:col-span-2">
                {t("businessData.deliveryPolicy.areaAliases", "Area names customers may use")}
                <input value={zone.areas.join(", ")} onChange={(event) => updateZone(zone.id, { areas: event.target.value.split(",").map((area) => area.trim()).filter(Boolean) })} disabled={disabled} placeholder={t("businessData.deliveryPolicy.areaAliasesPlaceholder", "Dhaka, Dhanmondi, Mirpur")} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                {t("businessData.deliveryPolicy.charge", "Charge ({{currency}})", { currency: policy.currency })}
                <input type="number" min={0} max={1000000} step="0.01" value={zone.charge} onChange={(event) => updateZone(zone.id, { charge: Number(event.target.value) || 0 })} disabled={disabled} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-medium text-foreground">
                  {t("businessData.deliveryPolicy.fastest", "Fastest (days)")}
                  <input type="number" min={0} max={365} value={zone.fastestDays} onChange={(event) => updateZone(zone.id, { fastestDays: Number(event.target.value) || 0 })} disabled={disabled} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                </label>
                <label className="space-y-1 text-xs font-medium text-foreground">
                  {t("businessData.deliveryPolicy.slowest", "Slowest (days)")}
                  <input type="number" min={0} max={365} value={zone.slowestDays} onChange={(event) => updateZone(zone.id, { slowestDays: Number(event.target.value) || 0 })} disabled={disabled} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
                </label>
              </div>
              <div className="flex items-end justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => onChange({ ...policy, zones: policy.zones.filter((item) => item.id !== zone.id) })} disabled={disabled} aria-label={t("businessData.deliveryPolicy.removeZone", "Remove area")} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="mt-3 block max-w-sm space-y-1 text-xs font-medium text-foreground">
        {t("businessData.deliveryPolicy.freeThreshold", "Free delivery from ({{currency}})", { currency: policy.currency })}
        <input type="number" min={0} max={1000000} step="0.01" value={policy.freeDeliveryMinimum ?? ""} onChange={(event) => onChange({ ...policy, freeDeliveryMinimum: event.target.value.trim() ? Number(event.target.value) || 0 : null })} disabled={disabled} placeholder={t("businessData.deliveryPolicy.noThreshold", "No free delivery threshold")} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
      </label>
    </section>
  );
}
