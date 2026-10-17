"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SecretFieldProps {
  /** Also the input's DOM id, so the label targets it. */
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Mask the value and show the reveal toggle. */
  secret?: boolean;
  /** Monospace face — for keys, ids and tokens. */
  mono?: boolean;
  /** Reveal state, owned by the page so it survives re-renders. */
  visible?: boolean;
  onToggleVisibility?: () => void;
  className?: string;
}

/**
 * One labelled credential input.
 *
 * The credential cards carry eight of these, five of them masked — the
 * password/eye-toggle pairing used to be copy-pasted at every site.
 */
export function SecretField({
  id,
  label,
  placeholder,
  value,
  onChange,
  secret = false,
  mono = true,
  visible = false,
  onToggleVisibility,
  className,
}: SecretFieldProps) {
  const { t } = useTranslation("couriers");
  const revealed = secret && visible;

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </Label>

      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : secret ? "password" : "text"}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`bg-muted/30 text-xs ${mono ? "font-mono" : ""} ${
            secret ? "pr-9" : ""
          }`}
        />

        {secret && onToggleVisibility && (
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={revealed ? t("a11y.hideValue") : t("a11y.showValue")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {revealed ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
