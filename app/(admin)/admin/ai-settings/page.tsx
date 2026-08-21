"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Check,
  ChevronsUpDown,
  Download,
  Filter,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ModelConfigSheet,
  type OpenRouterModelConfig,
} from "@/components/admin/ai-settings/ModelConfigSheet";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AISettingsData {
  quickSetup: {
    fastModel: string;
    smartModel: string;
    geniusModel: string;
  };
  models: OpenRouterModelConfig[];
  minCreditThreshold: number;
  defaultProvider: string;
  testChatMultiplier: number;
}

// ── Model Combobox Component ──────────────────────────────────────────────────
function ModelCombobox({
  models,
  value,
  onSelect,
  placeholder = "Select model...",
}: {
  models: OpenRouterModelConfig[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedModel = models.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between rounded-xl border-primary/20 bg-card text-xs font-normal hover:bg-muted/40"
        >
          {selectedModel ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-medium text-foreground truncate">
                {selectedModel.name}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                {selectedModel.provider}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 rounded-xl shadow-lg border-primary/10" align="start">
        <Command>
          <CommandInput placeholder="Search models by name or provider..." className="text-xs" />
          <CommandList className="max-h-60 no-scrollbar overflow-y-auto">
            <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">
              No model found.
            </CommandEmpty>
            <CommandGroup>
              {models.map((m) => {
                const isSelected = m.id === value;
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.name} ${m.provider} ${m.id}`}
                    onSelect={() => {
                      onSelect(m.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between text-xs py-2 px-3 rounded-lg cursor-pointer data-[selected=true]:bg-primary/10"
                  >
                    <div className="flex flex-col gap-0.5 truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium text-foreground truncate">{m.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          {m.provider}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ${m.promptPrice.toFixed(2)} / ${m.completionPrice.toFixed(2)} per 1M
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 text-primary ml-2 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AdminAISettingsPage() {
  const { t } = useTranslation("admin");

  const [settings, setSettings] = useState<AISettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingOpenRouter, setFetchingOpenRouter] = useState(false);

  // Search & Filter & Drawer state
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selectedModel, setSelectedModel] = useState<OpenRouterModelConfig | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // ── Fetch Settings ───────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data);
    } catch {
      toast.error(t("aiSettings.loadError", "Could not load AI settings."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Save Settings ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      toast.success(t("aiSettings.saveSuccess", "AI & Credit rules updated successfully!"));
      fetchSettings();
    } catch {
      toast.error(t("aiSettings.saveError", "Could not save settings. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // ── Fetch Live OpenRouter Catalog & Persist DB ──
  const handleFetchOpenRouterModels = async () => {
    setFetchingOpenRouter(true);
    try {
      const res = await fetch("/api/admin/ai-settings/fetch-models");
      if (!res.ok) throw new Error("Failed to fetch OpenRouter catalog");
      const data = await res.json();

      if (data.models && settings) {
        // Preserve manual credit overrides if present
        const currentOverrideMap = new Map(
          settings.models.filter((m) => m.isManualOverride).map((m) => [m.id, m.credits])
        );

        const updatedModels = data.models.map((m: OpenRouterModelConfig) => ({
          ...m,
          credits: currentOverrideMap.has(m.id) ? currentOverrideMap.get(m.id)! : m.credits,
          isManualOverride: currentOverrideMap.has(m.id),
        }));

        setSettings({
          ...settings,
          models: updatedModels,
          quickSetup: data.quickSetup || settings.quickSetup,
        });
        toast.success(`Fetched & saved ${data.total} popular models directly from OpenRouter!`);
      }
    } catch {
      toast.error("Could not fetch models from OpenRouter.");
    } finally {
      setFetchingOpenRouter(false);
    }
  };

  // ── Handlers for Model Updates ───────────────────────────────────────────────
  const handleToggleMerchantActive = (modelId: string, active: boolean) => {
    if (!settings) return;
    const updated = settings.models.map((m) =>
      m.id === modelId ? { ...m, isMerchantActive: active } : m
    );
    setSettings({ ...settings, models: updated });
  };

  const handleUpdateCreditCost = (modelId: string, credits: number) => {
    if (!settings) return;
    const updated = settings.models.map((m) =>
      m.id === modelId ? { ...m, credits, isManualOverride: true } : m
    );
    setSettings({ ...settings, models: updated });
  };

  const handleUpdateModelConfig = (updatedModel: OpenRouterModelConfig) => {
    if (!settings) return;
    const updatedModels = settings.models.map((m) =>
      m.id === updatedModel.id ? updatedModel : m
    );
    setSettings({ ...settings, models: updatedModels });
    toast.success(`${updatedModel.name} config updated.`);
  };

  if (loading || !settings) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("aiSettings.loading", "Loading AI & Credit settings…")}
      </div>
    );
  }

  // Dynamically derive unique provider list from loaded models dataset
  const uniqueProviders = Array.from(
    new Set(settings.models.map((m) => m.provider))
  ).filter(Boolean);

  // Filter models
  const filteredModels = settings.models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider =
      providerFilter === "all" || m.provider.toLowerCase() === providerFilter.toLowerCase();
    return matchesSearch && matchesProvider;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      {/* ── Top Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("aiSettings.title", "AI Model & Credit Rules Engine")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct OpenRouter live model catalog, auto-pricing calculations, and merchant availability matrix.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchOpenRouterModels}
            disabled={fetchingOpenRouter}
            className="rounded-xl gap-1.5 text-xs border-primary/20"
          >
            <Download className={cn("h-3.5 w-3.5 text-primary", fetchingOpenRouter && "animate-bounce")} />
            Fetch OpenRouter Models
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={fetchSettings}
            disabled={saving}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
            Reset
          </Button>

          <Button
            size="sm"
            className="rounded-xl gap-1.5 text-xs bg-brand-gradient text-primary-foreground hover:opacity-90"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </motion.div>

      {/* ── Top Card: Quick Setup Presets (Non-Pro Merchants) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="w-full rounded-2xl border border-primary/20 bg-card p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Quick Setup Presets (Default Tier Mapping)</h3>
              <p className="text-xs text-muted-foreground">
                Default fallback models for standard/starter merchants using Fast (1 Cr), Smart (3 Cr), or Genius (5 Cr) presets.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Fast Model (1 Credit) */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-success">Fast Model</span>
              <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success">Fixed 1 Credit</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">High-speed, low-cost responses</p>
            <ModelCombobox
              models={settings.models}
              value={settings.quickSetup.fastModel}
              onSelect={(val) =>
                setSettings({
                  ...settings,
                  quickSetup: { ...settings.quickSetup, fastModel: val },
                })
              }
              placeholder="Select Fast model..."
            />
          </div>

          {/* Smart Model (3 Credits) */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">Smart Model</span>
              <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/10 text-primary">Fixed 3 Credits</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Balanced intelligence & speed</p>
            <ModelCombobox
              models={settings.models}
              value={settings.quickSetup.smartModel}
              onSelect={(val) =>
                setSettings({
                  ...settings,
                  quickSetup: { ...settings.quickSetup, smartModel: val },
                })
              }
              placeholder="Select Smart model..."
            />
          </div>

          {/* Genius Model (5 Credits) */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-warning">Genius Model</span>
              <Badge variant="outline" className="text-[10px] border-warning/30 bg-warning/10 text-warning">Fixed 5 Credits</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Top-tier reasoning & accuracy</p>
            <ModelCombobox
              models={settings.models}
              value={settings.quickSetup.geniusModel}
              onSelect={(val) =>
                setSettings({
                  ...settings,
                  quickSetup: { ...settings.quickSetup, geniusModel: val },
                })
              }
              placeholder="Select Genius model..."
            />
          </div>
        </div>
      </motion.div>

      {/* ── Simplified LLM Catalog Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="w-full space-y-4"
      >
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-primary/10 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">LLM Models Catalog & Auto-Pricing</h3>
              <p className="text-xs text-muted-foreground">
                Showing {filteredModels.length} models • Auto-calculated credit cost based on OpenRouter token pricing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search models, providers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-primary/20"
              />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs border-primary/20">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Providers</SelectItem>
                {uniqueProviders.map((p) => (
                  <SelectItem key={p} value={p.toLowerCase()}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Catalog Table Container */}
        <div className="w-full border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-medium">Model Name & ID</th>
                  <th className="p-3.5 font-medium">Provider</th>
                  <th className="p-3.5 font-medium">Token Pricing (Prompt / Completion per 1M)</th>
                  <th className="p-3.5 font-medium">Credit Cost</th>
                  <th className="p-3.5 font-medium">Preset Status</th>
                  <th className="p-3.5 font-medium text-center">Merchant Active</th>
                  <th className="p-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredModels.map((m) => {
                  const isFast = settings.quickSetup.fastModel === m.id;
                  const isSmart = settings.quickSetup.smartModel === m.id;
                  const isGenius = settings.quickSetup.geniusModel === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 font-medium">
                        <div className="font-semibold text-foreground">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{m.id}</div>
                      </td>
                      <td className="p-3.5 text-muted-foreground font-medium">{m.provider}</td>
                      <td className="p-3.5 font-mono text-[11px]">
                        <span className="text-foreground">${m.promptPrice.toFixed(2)}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-foreground">${m.completionPrice.toFixed(2)}</span>
                      </td>
                      <td className="p-3.5 font-mono font-bold">
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={m.credits}
                          onChange={(e) =>
                            handleUpdateCreditCost(m.id, parseInt(e.target.value) || 1)
                          }
                          className="h-7 w-16 text-center font-bold text-xs rounded-lg border-primary/20 bg-background text-primary"
                        />
                      </td>
                      <td className="p-3.5">
                        {isFast && (
                          <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success">
                            Fast Preset (1 Cr)
                          </Badge>
                        )}
                        {isSmart && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/10 text-primary">
                            Smart Preset (3 Cr)
                          </Badge>
                        )}
                        {isGenius && (
                          <Badge variant="outline" className="text-[10px] border-warning/30 bg-warning/10 text-warning">
                            Genius Preset (5 Cr)
                          </Badge>
                        )}
                        {!isFast && !isSmart && !isGenius && (
                          <span className="text-[10px] text-muted-foreground font-mono">Custom Pro</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <Switch
                          checked={m.isMerchantActive}
                          onCheckedChange={(checked) => handleToggleMerchantActive(m.id, checked)}
                        />
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedModel(m);
                            setIsSheetOpen(true);
                          }}
                          className="h-8 px-2.5 rounded-lg text-xs gap-1 text-primary hover:bg-primary/10"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          Configure
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* ── Configure Model Drawer ── */}
      <ModelConfigSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        model={selectedModel}
        onSave={handleUpdateModelConfig}
      />
    </div>
  );
}
