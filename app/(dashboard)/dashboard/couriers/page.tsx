"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, ShieldCheck, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CourierProviderCard } from "./_components/CourierProviderCard";
import {
  COURIER_PROVIDERS,
  EMPTY_COURIER_FORM,
  toCourierForm,
} from "./_components/couriers-config";
import type {
  CourierFieldKey,
  CourierForm,
  CourierToggleKey,
} from "./_components/types";

/**
 * Courier credential setup — one card per provider, saved in a single request.
 *
 * Lives at `/dashboard/couriers` (E-Commerce Store) rather than under Settings:
 * these are store credentials, and the page is what the sidebar's "Courier
 * Settings" entry points at.
 */
export default function CouriersPage() {
  const { t } = useTranslation("couriers");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<CourierForm>(EMPTY_COURIER_FORM);

  // Load once on mount. Deliberately not keyed on `t`: re-running on a language
  // switch would refetch and discard credentials the merchant is mid-way through
  // typing.
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/couriers");
        const data = await res.json();
        if (data.success) setForm(toCourierForm(data.config));
      } catch (error) {
        console.error(error);
        toast.error(t("toast.loadFailed"));
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: CourierFieldKey, value: string) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const setToggle = (key: CourierToggleKey, enabled: boolean) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = enabled;
      return next;
    });

  const toggleSecret = (key: CourierFieldKey) =>
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("toast.saveSuccess"));
      } else {
        toast.error(data.error || t("toast.saveFailed"));
      }
    } catch {
      toast.error(t("toast.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
        {t("loading")}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold shrink-0 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4" />
          {t("secureBadge")}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {COURIER_PROVIDERS.map((provider) => (
          <CourierProviderCard
            key={provider.id}
            provider={provider}
            form={form}
            visibleSecrets={showSecrets}
            onToggleEnabled={(enabled) => setToggle(provider.enabledKey, enabled)}
            onChange={setField}
            onToggleSecret={toggleSecret}
          />
        ))}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="h-11 px-8 rounded-xl bg-brand-gradient hover:opacity-90 text-white font-bold text-xs shadow-lg gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("actions.saving")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t("actions.save")}
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
