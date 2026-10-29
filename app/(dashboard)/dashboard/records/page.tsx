"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Table2,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordsTable, type FieldDef } from "../chatbots/[chatbotId]/records/_components/RecordsTable";
import {
  SchemaManagerModal,
  type CustomTableSchemaItem,
} from "../chatbots/[chatbotId]/records/_components/SchemaManagerModal";
import { cn } from "@/lib/core/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AiDirectiveBanner } from "../chatbots/[chatbotId]/records/_components/AiDirectiveBanner";
import { useWorkspace } from "@/components/workspace-provider";
import { sortBusinessForms } from "@/lib/domain/business-form-order";
import { useTranslation } from "react-i18next";

export default function RecordsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathSlug = pathname?.startsWith("/dashboard/records/")
    ? decodeURIComponent(pathname.slice("/dashboard/records/".length).split("/")[0])
    : null;
  const legacyQuerySchema = searchParams?.get("schema");
  const [chatbotId, setChatbotId] = useState("");
  const [loadingBot, setLoadingBot] = useState(true);
  const { activeWorkspace, updateWorkspace } = useWorkspace();
  const { t } = useTranslation("business-data");
  const getFormDisplayName = (schema: CustomTableSchemaItem) => {
    const key = `formNames.${schema.slug}`;
    return schema.name === t(key, { lng: "en", defaultValue: schema.name })
      ? t(key, { defaultValue: schema.name })
      : schema.name;
  };
  const activeSchemaSlug = pathSlug || legacyQuerySchema || null;

  const [schemas, setSchemas] = useState<CustomTableSchemaItem[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Business zone title customization state
  const [chatbotMode, setChatbotMode] = useState<string>(activeWorkspace?.category ?? "custom");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chatbots")
      .then((response) => response.json())
      .then((data: unknown) => {
        const bots = Array.isArray(data) ? data as Array<{ chatbotId: string; workspaceId?: string | null }> : [];
        if (cancelled) return;
        const workspaceBots = bots.filter((bot) => bot.workspaceId === activeWorkspace?.workspaceId);
        const selectedBot = workspaceBots[0] ?? bots[0];
        setChatbotId(selectedBot?.chatbotId ?? "");
      })
      .catch(() => setChatbotId(""))
      .finally(() => { if (!cancelled) setLoadingBot(false); });
    return () => { cancelled = true; };
  }, [activeWorkspace?.workspaceId]);

  useEffect(() => {
    const query = searchParams?.toString() ?? "";
    if (!query) return;
    const target = pathSlug
      ? `/dashboard/records/${encodeURIComponent(pathSlug)}`
      : legacyQuerySchema
        ? `/dashboard/records/${encodeURIComponent(legacyQuerySchema)}`
        : "/dashboard/records";
    router.replace(target);
  }, [legacyQuerySchema, pathSlug, router, searchParams]);

  const setActiveSchemaSlug = useCallback((slug: string | null) => {
    router.push(slug ? `/dashboard/records/${encodeURIComponent(slug)}` : "/dashboard/records");
  }, [router]);

  // Fetch bot details for mode and customBusinessZoneTitle
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize the workspace-scoped title editor from the selected business.
    setChatbotMode(activeWorkspace?.category ?? "custom");
    setCustomTitle(activeWorkspace?.customBusinessTitle ?? "");
    setTitleInput(activeWorkspace?.customBusinessTitle ?? "");
  }, [activeWorkspace?.category, activeWorkspace?.customBusinessTitle]);

  useEffect(() => {
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setChatbotMode(activeWorkspace?.category || data.chatbotMode || "custom");
        }
      })
      .catch(() => {});
  }, [chatbotId, activeWorkspace?.category]);

  const handleSaveTitle = async () => {
    if (!activeWorkspace) return;
    setSavingTitle(true);
    try {
      const workspace = await updateWorkspace(activeWorkspace.workspaceId, activeWorkspace.name, activeWorkspace.logoUrl ?? undefined, activeWorkspace.category ?? undefined, titleInput.trim());
      if (workspace) {
        setCustomTitle(titleInput.trim());
        setIsEditingTitle(false);
        toast.success(t("page.titleSaved"));
      } else {
        toast.error(t("page.titleSaveFailed"));
      }
    } catch {
      toast.error(t("page.genericError"));
    } finally {
      setSavingTitle(false);
    }
  };

  const fetchSchemas = useCallback(async () => {
    if (!chatbotId) return;
    setLoadingSchemas(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/custom-schemas`);
      const data = await res.json();
      if (res.ok && data.schemas) {
        setSchemas(sortBusinessForms(data.schemas, activeWorkspace?.category));
        window.dispatchEvent(new Event("business-schemas-updated"));
      }
    } catch (err) {
      console.error("[FETCH_SCHEMAS_ERROR]", err);
    } finally {
      setLoadingSchemas(false);
    }
  }, [activeWorkspace, chatbotId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the current agent's table definitions.
    fetchSchemas();
  }, [fetchSchemas]);

  const activeSchema = schemas.find((s) => s.slug === activeSchemaSlug) || null;
  const activeFields: FieldDef[] = (activeSchema?.fields as FieldDef[]) || [];

  if (loadingBot || activeWorkspace === null) {
    return <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("page.loading")}</div>;
  }

  if (!chatbotId) {
    return (
      <div className="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <Table2 className="mb-3 h-9 w-9 text-primary/60" />
        <h1 className="text-lg font-semibold text-foreground">{t("page.createAgentTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("page.noAgent", { category: t(`categories.${activeWorkspace.category || "custom"}`) })}</p>
        <Button asChild className="mt-5 rounded-full"><Link href="/dashboard/chatbots">{t("page.createAgent")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ─── Header row ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate flex items-center gap-2">
              <Table2 className="w-6 h-6 text-primary" />
              {customTitle || t("page.title")}
            </h1>
            {!isEditingTitle ? (
              <button
                type="button"
                onClick={() => {
                  setTitleInput(customTitle || t("page.titleInput"));
                  setIsEditingTitle(true);
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title={t("page.rename")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={t("page.titlePlaceholder")}
                  className="h-7 text-xs w-48"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={savingTitle}
                  className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  title="Save"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <Badge variant="outline" className="text-xs font-mono">
              {t("page.customEntity")}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
            {t("page.description")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchSchemas}
            disabled={loadingSchemas}
            className="rounded-full gap-1.5 h-9 text-xs cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loadingSchemas && "animate-spin")} />
            {t("page.refresh")}
          </Button>

          <Button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            size="sm"
            className="rounded-full bg-brand-gradient text-white font-bold gap-1.5 h-9 text-xs shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            {t("page.manageForms")}
          </Button>
        </div>
      </div>

      {/* ─── AI Transparency Directive Banner ─────────────────────────── */}
      {activeSchema && (
        <AiDirectiveBanner
          schemas={schemas}
          activeSchema={activeSchema}
          chatbotMode={chatbotMode}
          chatbotId={chatbotId}
        />
      )}

      {/* ─── Schema Tabs Bar ─────────────────────────────────────────── */}
      {schemas.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveSchemaSlug(null)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              activeSchemaSlug === null
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t("page.allForms")}
          </button>

          {schemas.map((s) => {
            const isActive = activeSchemaSlug === s.slug;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSchemaSlug(s.slug)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>{getFormDisplayName(s)}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {s._count?.records ?? 0}
                </span>
              </button>
            );
          })}

        </div>
      )}

      {/* ─── Empty state when no schemas exist ─────────────────────────── */}
      {!loadingSchemas && schemas.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card/60 backdrop-blur-sm space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">
              {t("page.noFormsTitle")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("page.noFormsDescription")}
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            className="rounded-full bg-brand-gradient text-white font-bold gap-2 shadow-md cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            {t("page.createFirstForm")}
          </Button>
        </div>
      ) : (
        /* ─── Records Table ─────────────────────────────────────────── */
        <>
        {loadingSchemas ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">{t("page.loadingForms")}</div>
        ) : schemas.length > 0 && !activeSchemaSlug ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {schemas.map((schema) => (
              <button
                key={schema.id}
                type="button"
                onClick={() => setActiveSchemaSlug(schema.slug)}
                className="group rounded-2xl border border-border/70 bg-card p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.02] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Table2 className="h-5 w-5" /></span>
                  <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </span>
                <span className="mt-4 block text-base font-semibold text-foreground">{getFormDisplayName(schema)}</span>
                <span className="mt-1 block min-h-10 text-sm leading-5 text-muted-foreground">{t(`formDescriptions.${schema.slug}`, { defaultValue: schema.description || t("page.formDescriptionFallback") })}</span>
                <span className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                  <span className="rounded-lg bg-muted/60 px-3 py-2">
                    <span className="block text-lg font-semibold text-foreground">{schema.fields?.length ?? 0}</span>
                    <span className="text-xs text-muted-foreground">{t("page.columns")}</span>
                  </span>
                  <span className="rounded-lg bg-muted/60 px-3 py-2">
                    <span className="block text-lg font-semibold text-foreground">{schema._count?.records ?? 0}</span>
                    <span className="text-xs text-muted-foreground">{t("page.rows")}</span>
                  </span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
            >
              <Plus className="mb-2 h-6 w-6" />
              <span className="text-sm font-semibold">{t("page.createForm")}</span>
              <span className="mt-1 text-xs">{t("page.addColumnsHint")}</span>
            </button>
          </div>
        ) : activeSchema ? (
          <RecordsTable chatbotId={chatbotId} schemaSlug={activeSchemaSlug} schemaFields={activeFields} />
        ) : activeSchemaSlug ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("page.missingForm")}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setActiveSchemaSlug(null)}>{t("page.backToForms")}</Button>
          </div>
        ) : null}
        </>
      )}

      {/* ─── Schema Manager Drawer Modal ───────────────────────────────── */}
      <SchemaManagerModal
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
        chatbotId={chatbotId}
        schemas={schemas}
        onSchemaCreated={() => {
          fetchSchemas();
        }}
        onSchemaUpdated={() => {
          fetchSchemas();
        }}
        onSchemaDeleted={() => {
          fetchSchemas();
          setActiveSchemaSlug(null);
        }}
      />
    </div>
  );
}

