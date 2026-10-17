"use client";

import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecretField } from "./SecretField";
import type { CourierFieldKey, CourierForm, CourierProvider } from "./types";

interface CourierProviderCardProps {
  provider: CourierProvider;
  form: CourierForm;
  visibleSecrets: Record<string, boolean>;
  onToggleEnabled: (enabled: boolean) => void;
  onChange: (key: CourierFieldKey, value: string) => void;
  onToggleSecret: (key: CourierFieldKey) => void;
}

/**
 * Credential card for one courier: header (badge, name, description, enable
 * switch) plus its inputs.
 *
 * Everything provider-specific arrives through `provider`, so Steadfast,
 * Pathao and RedX share this single implementation.
 */
export function CourierProviderCard({
  provider,
  form,
  visibleSecrets,
  onToggleEnabled,
  onChange,
  onToggleSecret,
}: CourierProviderCardProps) {
  const { t } = useTranslation("couriers");
  const enabled = form[provider.enabledKey];

  return (
    <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`p-2.5 rounded-xl text-sm font-bold ${provider.badgeClass}`}
          >
            {provider.emoji}
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {t(`providers.${provider.id}.name`)}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t(`providers.${provider.id}.description`)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* The switch carries the state visually; this label voices it. */}
          <Label className="text-xs text-muted-foreground">
            {enabled ? t("enabled") : t("disabled")}
          </Label>
          <Switch
            checked={enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={t(`providers.${provider.id}.name`)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {provider.fields.map((field) => (
          <SecretField
            key={field.key}
            id={field.key}
            label={t(`fields.${field.key}.label`)}
            placeholder={t(`fields.${field.key}.placeholder`)}
            value={form[field.key]}
            secret={field.secret}
            mono={field.mono}
            visible={!!visibleSecrets[field.key]}
            onChange={(value) => onChange(field.key, value)}
            onToggleVisibility={() => onToggleSecret(field.key)}
            className={field.fullWidth ? "sm:col-span-2" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
