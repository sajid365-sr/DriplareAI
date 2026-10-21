"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, TrendingDown, Package, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { RiskLevel, RiskProfile } from "@/lib/domain/customer-risk";

interface CustomerRiskPanelProps {
  phone?: string | null;
}

const riskConfig: Record<
  RiskLevel,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    Icon: typeof Shield;
  }
> = {
  LOW: {
    label: "Low Risk",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    Icon: Shield,
  },
  MEDIUM: {
    label: "Medium Risk",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    Icon: AlertTriangle,
  },
  HIGH: {
    label: "High Risk",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    Icon: TrendingDown,
  },
};

/** Displays a customer's delivery risk profile in the OrderSheet (Feature #25). */
export function CustomerRiskPanel({ phone }: CustomerRiskPanelProps) {
  const { t } = useTranslation("orders");
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!phone) return;

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/risk-profile?phone=${encodeURIComponent(phone)}`);
        const data = (await res.json()) as { success?: boolean; profile?: RiskProfile };
        if (!cancelled && res.ok && data.success && data.profile) {
          setProfile(data.profile);
        }
      } catch {
        // Silently ignore fetch errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  if (!phone) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-border/40 bg-muted/30 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        {t("riskProfile.loading", "Loading risk profile...")}
      </div>
    );
  }

  if (!profile) return null;

  const config = riskConfig[profile.riskLevel];
  const RiskIcon = config.Icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`space-y-2.5 p-3.5 rounded-xl border ${config.borderColor} ${config.bgColor}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <RiskIcon className={`w-3.5 h-3.5 ${config.color}`} />
            {t("riskProfile.title", "Customer Risk Profile")}
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bgColor} ${config.color} border ${config.borderColor}`}
          >
            {profile.riskLevel === "LOW"
              ? t("riskProfile.low", config.label)
              : profile.riskLevel === "MEDIUM"
              ? t("riskProfile.medium", config.label)
              : t("riskProfile.high", config.label)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-card/60 border border-border/30">
            <Package className="w-3 h-3 text-muted-foreground mb-1" />
            <span className="text-[13px] font-bold text-foreground">{profile.totalOrders}</span>
            <span className="text-[9px] text-muted-foreground">{t("riskProfile.totalOrders", "Total Orders")}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-card/60 border border-border/30">
            <RotateCcw className="w-3 h-3 text-amber-500 mb-1" />
            <span className="text-[13px] font-bold text-foreground">{profile.returnRate}%</span>
            <span className="text-[9px] text-muted-foreground">{t("riskProfile.returnRate", "Return Rate")}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-card/60 border border-border/30">
            <XCircle className="w-3 h-3 text-destructive mb-1" />
            <span className="text-[13px] font-bold text-foreground">{profile.cancelRate}%</span>
            <span className="text-[9px] text-muted-foreground">{t("riskProfile.cancelRate", "Cancel Rate")}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{t("riskProfile.riskScore", "Risk Score")}</span>
            <span className={`font-bold ${config.color}`}>{profile.riskScore}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile.riskScore}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${
                profile.riskLevel === "HIGH"
                  ? "bg-destructive"
                  : profile.riskLevel === "MEDIUM"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
