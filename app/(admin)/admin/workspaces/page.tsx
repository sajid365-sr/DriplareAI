"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Building2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FinancialSummaryCards, type KpiSummaryData } from "@/components/admin/workspaces/FinancialSummaryCards";
import { WorkspaceTable, type WorkspaceRow } from "@/components/admin/workspaces/WorkspaceTable";

interface WorkspacesApiResponse {
  workspaces: WorkspaceRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  kpiSummary: KpiSummaryData;
}

export default function AdminWorkspacesPage() {
  const { t } = useTranslation("admin");
  const [data, setData] = useState<WorkspacesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/workspaces?${params}`);
      if (!res.ok) throw new Error("Failed to load workspaces");

      const resData = await res.json();
      setData(resData);
    } catch {
      toast.error(t("workspaces.loadError", "Failed to load workspace data"));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const defaultKpiSummary: KpiSummaryData = data?.kpiSummary || {
    totalWorkspaces: 0,
    totalMrrBdt: 0,
    totalApiCostUsd: 0,
    totalApiCostBdt: 0,
    totalNetProfitBdt: 0,
    overallMarginPercent: 0,
    highCostAlertCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("workspaces.title", "Workspace Admin & Financial Analytics")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspaces.description", "Manage merchant workspaces, monitor OpenRouter API costs, unit economics & net margins.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
              placeholder={t("workspaces.searchPlaceholder", "Search workspace or owner email...")}
              className="w-64 rounded-xl pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setSearch(searchInput);
              setPage(1);
            }}
          >
            {t("workspaces.search", "Search")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchWorkspaces}
            className="rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      {/* Top Financial KPI Summary Cards */}
      <FinancialSummaryCards summary={defaultKpiSummary} loading={loading && !data} />

      {/* Primary Workspaces Table */}
      <WorkspaceTable workspaces={data?.workspaces || []} loading={loading && !data} />

      {/* Pagination Controls */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total workspaces)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
