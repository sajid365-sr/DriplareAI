"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, ShieldCheck, Eye, EyeOff, Save, Key, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function CourierSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    // Steadfast
    steadfastEnabled: false,
    steadfastApiKey: "",
    steadfastSecretKey: "",
    // Pathao
    pathaoEnabled: false,
    pathaoClientId: "",
    pathaoClientSecret: "",
    pathaoUsername: "",
    pathaoPassword: "",
    pathaoStoreId: "",
    // RedX
    redxEnabled: false,
    redxApiToken: "",
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/couriers");
        const data = await res.json();
        if (data.success && data.config) {
          setForm({
            steadfastEnabled: !!data.config.steadfastEnabled,
            steadfastApiKey: data.config.steadfastApiKey || "",
            steadfastSecretKey: data.config.steadfastSecretKey || "",
            pathaoEnabled: !!data.config.pathaoEnabled,
            pathaoClientId: data.config.pathaoClientId || "",
            pathaoClientSecret: data.config.pathaoClientSecret || "",
            pathaoUsername: data.config.pathaoUsername || "",
            pathaoPassword: data.config.pathaoPassword || "",
            pathaoStoreId: data.config.pathaoStoreId || "",
            redxEnabled: !!data.config.redxEnabled,
            redxApiToken: data.config.redxApiToken || "",
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load courier settings");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const toggleSecret = (field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Courier credentials saved successfully!");
      } else {
        toast.error(data.error || "Failed to save courier credentials");
      }
    } catch {
      toast.error("An error occurred while saving credentials");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
        Loading Courier API Settings...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-violet-600/10 via-blue-600/10 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Courier API Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Configure your official merchant credentials for Steadfast, Pathao, and RedX to enable automated bulk parcel creation and live tracking sync directly from your dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4" />
          Encrypted & Secure
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. STEADFAST COURIER */}
        <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                🚚
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">Steadfast Express</h3>
                <p className="text-[11px] text-muted-foreground">
                  Steadfast Courier merchant API integration (API Key & Secret)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {form.steadfastEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                checked={form.steadfastEnabled}
                onCheckedChange={(val) => setForm({ ...form, steadfastEnabled: val })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Steadfast API Key</Label>
              <div className="relative">
                <Input
                  type={showSecrets["steadfastApiKey"] ? "text" : "password"}
                  placeholder="Enter API Key"
                  value={form.steadfastApiKey}
                  onChange={(e) => setForm({ ...form, steadfastApiKey: e.target.value })}
                  className="bg-muted/30 font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret("steadfastApiKey")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets["steadfastApiKey"] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Steadfast Secret Key</Label>
              <div className="relative">
                <Input
                  type={showSecrets["steadfastSecretKey"] ? "text" : "password"}
                  placeholder="Enter Secret Key"
                  value={form.steadfastSecretKey}
                  onChange={(e) => setForm({ ...form, steadfastSecretKey: e.target.value })}
                  className="bg-muted/30 font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret("steadfastSecretKey")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets["steadfastSecretKey"] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PATHAO COURIER */}
        <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm">
                🏍️
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">Pathao Courier</h3>
                <p className="text-[11px] text-muted-foreground">
                  Pathao Merchant API v2 authentication credentials
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {form.pathaoEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                checked={form.pathaoEnabled}
                onCheckedChange={(val) => setForm({ ...form, pathaoEnabled: val })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Client ID</Label>
              <Input
                placeholder="Pathao Client ID"
                value={form.pathaoClientId}
                onChange={(e) => setForm({ ...form, pathaoClientId: e.target.value })}
                className="bg-muted/30 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Client Secret</Label>
              <div className="relative">
                <Input
                  type={showSecrets["pathaoClientSecret"] ? "text" : "password"}
                  placeholder="Pathao Client Secret"
                  value={form.pathaoClientSecret}
                  onChange={(e) => setForm({ ...form, pathaoClientSecret: e.target.value })}
                  className="bg-muted/30 font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret("pathaoClientSecret")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets["pathaoClientSecret"] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Username / Email</Label>
              <Input
                placeholder="merchant@example.com"
                value={form.pathaoUsername}
                onChange={(e) => setForm({ ...form, pathaoUsername: e.target.value })}
                className="bg-muted/30 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Password</Label>
              <div className="relative">
                <Input
                  type={showSecrets["pathaoPassword"] ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.pathaoPassword}
                  onChange={(e) => setForm({ ...form, pathaoPassword: e.target.value })}
                  className="bg-muted/30 font-mono text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => toggleSecret("pathaoPassword")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets["pathaoPassword"] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-foreground">Store ID</Label>
              <Input
                placeholder="e.g. 10482"
                value={form.pathaoStoreId}
                onChange={(e) => setForm({ ...form, pathaoStoreId: e.target.value })}
                className="bg-muted/30 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* 3. REDX COURIER */}
        <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-sm">
                📦
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">RedX Logistics</h3>
                <p className="text-[11px] text-muted-foreground">
                  RedX merchant API access bearer token
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">
                {form.redxEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                checked={form.redxEnabled}
                onCheckedChange={(val) => setForm({ ...form, redxEnabled: val })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">RedX API Token</Label>
            <div className="relative">
              <Input
                type={showSecrets["redxApiToken"] ? "text" : "password"}
                placeholder="Bearer eyJhbGciOi..."
                value={form.redxApiToken}
                onChange={(e) => setForm({ ...form, redxApiToken: e.target.value })}
                className="bg-muted/30 font-mono text-xs pr-9"
              />
              <button
                type="button"
                onClick={() => toggleSecret("redxApiToken")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecrets["redxApiToken"] ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="h-11 px-8 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold text-xs shadow-lg gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Credentials...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Courier Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
