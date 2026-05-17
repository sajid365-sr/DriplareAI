"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, Info, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export function BusinessSettings() {
  const { t, i18n } = useTranslation("settings");
  const [cost, setCost] = useState<string>("15");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isBn = i18n.language === "bn";

  useEffect(() => {
    setLoading(true);
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(data => {
        if (data.supportCostPerHour !== undefined) {
          setCost(data.supportCostPerHour.toString());
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        body: JSON.stringify({ 
          supportCostPerHour: parseFloat(cost),
          dataRetention: "forever" // Maintain existing field
        }),
      });

      if (res.ok) {
        setSaved(true);
        toast.success(t("profile.roi.success", "Settings saved successfully"));
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl border border-border bg-card overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">
            {t("profile.roi.title", "Business ROI Settings")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("profile.roi.subtitle", "Customize how your savings are calculated")}
          </p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="space-y-3">
          <label className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            {t("profile.roi.costLabel", "Estimated Human Support Cost (per hour)")}
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {isBn ? "৳" : "$"}
              </span>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="pl-7 rounded-xl border-border bg-background/50 focus:ring-primary/20"
                disabled={loading || saving}
              />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {t("profile.roi.perHour", "/ hour")}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 mt-2 bg-muted/30 p-3 rounded-xl border border-border/50">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            {t("profile.roi.info", "This value is used to calculate your 'Money Saved' on the Overview page. It should represent the average hourly wage or cost of a human support agent.")}
          </p>
        </div>

        <div className="pt-2">
          <Button 
            onClick={handleSave} 
            disabled={saving || loading}
            className="rounded-xl px-6 bg-primary hover:opacity-90 transition-all gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                {t("profile.roi.saved", "Saved")}
              </>
            ) : (
              <>
                {saving ? "..." : <Save className="w-4 h-4" />}
                {t("profile.roi.save", "Update ROI Settings")}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
