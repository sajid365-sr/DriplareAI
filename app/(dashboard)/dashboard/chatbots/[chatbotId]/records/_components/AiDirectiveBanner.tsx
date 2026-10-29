"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronDown,
  Zap,
  ClipboardList,
  CheckCircle,
  Database,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useTranslation } from "react-i18next";

interface Schema {
  name: string;
  slug: string;
  fields: Array<{ label: string; type: string; required?: boolean }>;
  description?: string | null;
}

interface AiDirectiveBannerProps {
  schemas: Schema[];
  activeSchema: Schema | null;
  chatbotMode: string;
  chatbotId: string;
}

export function AiDirectiveBanner({
  schemas,
  activeSchema,
  chatbotMode,
  chatbotId,
}: AiDirectiveBannerProps) {
  const { t } = useTranslation("business-data");
  const [expanded, setExpanded] = useState(false);
  const trigger = t(`directive.intents.${chatbotMode}`, {
    defaultValue: t("directive.intents.general"),
  });
  const schema = activeSchema ?? schemas[0];
  const schemaName = schema && schema.name === t(`formNames.${schema.slug}`, { lng: "en", defaultValue: schema.name })
    ? t(`formNames.${schema.slug}`, { defaultValue: schema.name })
    : schema?.name;

  if (!schema) return null;

  const requiredFields = (schema.fields || []).filter((f) => f.required);
  const optionalFields = (schema.fields || []).filter((f) => !f.required);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              {t("directive.title", {
                name: schemaName,
              })}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-mono tracking-wider border-primary/30 text-primary bg-primary/10 px-2 py-0.5"
            >
              {t("directive.active")}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {expanded ? t("directive.hideDetails") : t("directive.viewFlow")}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="banner-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-primary/10">
              {/* 4-step workflow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>1. {t("directive.triggerIntent")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {trigger}
                  </p>
                </div>

                {/* Step 2 */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                    <span>2. {t("directive.dataCollection")}</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar">
                    {requiredFields.map((f) => (
                      <div key={f.label} className="flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-foreground font-medium truncate">
                          {f.label}
                        </span>
                        <span className="text-muted-foreground text-[10px] shrink-0">
                          ({f.type})*
                        </span>
                      </div>
                    ))}
                    {optionalFields.map((f) => (
                      <div
                        key={f.label}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                        <span className="truncate">{f.label}</span>
                        <span className="text-[10px] shrink-0">({f.type})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3 */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>3. {t("directive.confirmation")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("directive.confirmationText")}
                  </p>
                </div>

                {/* Step 4 */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                    <Database className="w-3.5 h-3.5 text-violet-500" />
                    <span>4. {t("directive.savedHere")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("directive.savedText")}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1.5 rounded-full cursor-pointer hover:bg-primary/5"
                  asChild
                >
                  <Link href={`/dashboard/chatbots/${chatbotId}/playground`}>
                    <Zap className="w-3 h-3 text-amber-500" /> {t("directive.testPlayground")}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1.5 rounded-full cursor-pointer hover:bg-primary/5"
                  asChild
                >
                  <Link href={`/dashboard/chatbots/${chatbotId}/setup`}>
                    <ExternalLink className="w-3 h-3 text-primary" /> {t("directive.viewSetup")}
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
