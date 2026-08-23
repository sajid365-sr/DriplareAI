"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  ModelConfigSheet,
  type OpenRouterModelConfig,
} from "@/components/admin/ai-settings/ModelConfigSheet";

import { type AISettingsData } from "./_components/types";
import { AISettingsHeader } from "./_components/AISettingsHeader";
import { QuickSetupPresets } from "./_components/QuickSetupPresets";
import { ModelCatalogToolbar } from "./_components/ModelCatalogToolbar";
import { ModelCatalogTable } from "./_components/ModelCatalogTable";
import { ModelPagination } from "./_components/ModelPagination";
import { DeleteModelModal } from "./_components/DeleteModelModal";

export default function AdminAISettingsPage() {
  const { t } = useTranslation("admin");

  const [settings, setSettings] = useState<AISettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingOpenRouter, setFetchingOpenRouter] = useState(false);
  const [validatingModels, setValidatingModels] = useState(false);

  // Search & Multi-Criteria Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creditFilter, setCreditFilter] = useState("all");

  // Drawer & Modal state
  const [selectedModel, setSelectedModel] = useState<OpenRouterModelConfig | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<OpenRouterModelConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Advanced Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Auto-Collapse Main Admin Sidebar on Component Mount ──
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("driplare:collapse-sidebar", { detail: true })
    );
  }, []);

  // Reset to Page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, providerFilter, statusFilter, creditFilter]);

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

  // ── Validate Model Status via OpenRouter ──────────────────────────────────
  const handleValidateModels = async () => {
    setValidatingModels(true);
    try {
      const res = await fetch("/api/admin/ai-settings/validate-models", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();

      if (data.models && settings) {
        setSettings({
          ...settings,
          models: data.models,
        });
        if (data.deprecatedCount > 0) {
          toast.warning(
            `Validation complete: ${data.deprecatedCount} model(s) marked as deprecated.`
          );
        } else {
          toast.success("Validation complete: All models are active on OpenRouter!");
        }
      }
    } catch {
      toast.error("Could not validate models against OpenRouter catalog.");
    } finally {
      setValidatingModels(false);
    }
  };

  // ── Handlers for Model Updates & Deletion ───────────────────────────────────
  const handleUpdateQuickSetup = (
    key: "fastModel" | "smartModel" | "geniusModel",
    value: string
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      quickSetup: { ...settings.quickSetup, [key]: value },
    });
  };

  const handleToggleMerchantActive = (modelId: string, active: boolean) => {
    if (!settings) return;
    const updated = settings.models.map((m) =>
      m.id === modelId ? { ...m, isMerchantActive: m.isDeprecated ? false : active } : m
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

  const confirmDeleteModel = async () => {
    if (!modelToDelete || !settings) return;
    setDeleting(true);
    try {
      const updatedModels = settings.models.filter((m) => m.id !== modelToDelete.id);
      const newSettings = { ...settings, models: updatedModels };

      setSettings(newSettings);

      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!res.ok) throw new Error("Failed to update settings in database");

      toast.success(`${modelToDelete.name || "Model"} deleted successfully.`);
      setModelToDelete(null);
    } catch {
      toast.error("Failed to delete model from database.");
    } finally {
      setDeleting(false);
    }
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

  // Multi-Criteria Model Filtering
  const filteredModels = settings.models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProvider =
      providerFilter === "all" || m.provider.toLowerCase() === providerFilter.toLowerCase();

    let matchesStatus = true;
    if (statusFilter === "active") matchesStatus = !m.isDeprecated;
    else if (statusFilter === "deprecated") matchesStatus = !!m.isDeprecated;
    else if (statusFilter === "merchant-on") matchesStatus = m.isMerchantActive;
    else if (statusFilter === "merchant-off") matchesStatus = !m.isMerchantActive;

    let matchesCredit = true;
    if (creditFilter === "1") matchesCredit = m.credits === 1;
    else if (creditFilter === "3") matchesCredit = m.credits === 3;
    else if (creditFilter === "5") matchesCredit = m.credits === 5;
    else if (creditFilter === "custom") matchesCredit = m.credits !== 1 && m.credits !== 3 && m.credits !== 5;

    return matchesSearch && matchesProvider && matchesStatus && matchesCredit;
  });

  // Calculate Pagination Values
  const totalItems = filteredModels.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = filteredModels.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full pb-10">
      {/* ── 1. Full-Screen Blur Overlay Loading for "Validate Status" ── */}
      {validatingModels && (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xl animate-pulse">
            <ShieldAlert className="h-8 w-8 animate-spin" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h4 className="text-lg font-bold tracking-tight text-foreground">
              Validating Live Models with OpenRouter...
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Checking database model status against OpenRouter live catalog. Please wait.
            </p>
          </div>
        </div>
      )}

      {/* ── Top Header ── */}
      <AISettingsHeader
        validatingModels={validatingModels}
        fetchingOpenRouter={fetchingOpenRouter}
        saving={saving}
        onValidateModels={handleValidateModels}
        onFetchOpenRouterModels={handleFetchOpenRouterModels}
        onReFetch={fetchSettings}
        onSave={handleSave}
      />

      {/* ── Top Card: Quick Setup Presets (Non-Pro Merchants) ── */}
      <QuickSetupPresets
        settings={settings}
        onUpdateQuickSetup={handleUpdateQuickSetup}
      />

      {/* ── Simplified LLM Catalog Table & Pagination Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="w-full space-y-4"
      >
        {/* Toolbar with Multi-Criteria Filters */}
        <ModelCatalogToolbar
          totalItems={totalItems}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          providerFilter={providerFilter}
          onProviderFilterChange={setProviderFilter}
          uniqueProviders={uniqueProviders}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          creditFilter={creditFilter}
          onCreditFilterChange={setCreditFilter}
        />

        {/* Catalog Table & Pagination Controls */}
        <div className="w-full border rounded-2xl bg-card shadow-xs overflow-hidden">
          <ModelCatalogTable
            paginatedModels={paginatedModels}
            settings={settings}
            onUpdateCreditCost={handleUpdateCreditCost}
            onToggleMerchantActive={handleToggleMerchantActive}
            onConfigureModel={(model) => {
              setSelectedModel(model);
              setIsSheetOpen(true);
            }}
            onDeleteModel={(model) => setModelToDelete(model)}
          />

          <ModelPagination
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            onPageChange={setCurrentPage}
          />
        </div>
      </motion.div>

      {/* ── Configure Model Drawer ── */}
      <ModelConfigSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        model={selectedModel}
        onSave={handleUpdateModelConfig}
      />

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModelModal
        modelToDelete={modelToDelete}
        onClose={() => setModelToDelete(null)}
        onConfirm={confirmDeleteModel}
        deleting={deleting}
      />
    </div>
  );
}
