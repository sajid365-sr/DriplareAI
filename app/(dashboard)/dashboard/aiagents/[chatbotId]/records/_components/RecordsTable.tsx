"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MoreHorizontal,
  Search,
  RefreshCw,
  Inbox,
  MessageSquare,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";

/* ─────────────────────────── Types ─────────────────────────── */

export interface FieldDef {
  key: string;
  label: string;
  labelBn?: string;
  type: "text" | "number" | "date" | "phone" | "select" | "boolean";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface CustomRecord {
  id: string;
  schemaId: string;
  customerName?: string;
  customerPhone?: string;
  data: Record<string, unknown>;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes?: string;
  createdAt: string;
  schema: {
    id: string;
    name: string;
    slug: string;
    fields: FieldDef[];
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RecordsTableProps {
  chatbotId: string;
  schemaSlug: string | null;
  schemaFields: FieldDef[];
}

/* ─────────────────────────── Status config ─────────────────── */

const STATUS_OPTIONS = ["pending", "confirmed", "completed", "cancelled"] as const;
type StatusValue = (typeof STATUS_OPTIONS)[number];

const STATUS_CONFIG: Record<
  StatusValue,
  { classes: string }
> = {
  pending: {
    classes:
      "bg-warning/10 text-warning border-warning/20",
  },
  confirmed: {
    classes:
      "bg-success/10 text-success border-success/20",
  },
  completed: {
    classes:
      "bg-info/10 text-info border-info/20",
  },
  cancelled: {
    classes:
      "bg-destructive/10 text-destructive border-destructive/20",
  },
};

/* ─────────────────────────── CSV export ────────────────────── */

function downloadCSV(records: CustomRecord[], fields: FieldDef[], labels: { customer: string; phone: string; status: string; date: string }, isBengali: boolean) {
  const csvHeaders = [
    labels.customer,
    labels.phone,
    ...fields.map((field) => field.label),
    labels.status,
    labels.date,
  ];
  const rows = records.map((r) => [
    r.customerName ?? "",
    r.customerPhone ?? "",
    ...fields.map((f) => String(r.data[f.key] ?? "")),
    r.status,
    new Date(r.createdAt).toLocaleDateString(isBengali ? "bn-BD" : "en-US"),
  ]);
  const csv = [csvHeaders, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "records.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────── Skeleton row ───────────────────── */

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ─────────────────────────── Empty state ───────────────────── */

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation("business-data");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Inbox className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {filtered ? t("table.noMatches") : t("table.noRecords")}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? t("table.adjustFilters")
            : t("table.recordsAppear")}
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Main component ─────────────────── */

export function RecordsTable({
  chatbotId,
  schemaSlug,
  schemaFields,
}: RecordsTableProps) {
  const { t, i18n } = useTranslation("business-data");
  const isBengali = i18n.resolvedLanguage?.startsWith("bn") ?? false;
  const [records, setRecords] = useState<CustomRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ───── Fetch records ───── */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (schemaSlug) params.set("schema", schemaSlug);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(
        `/api/chatbots/${chatbotId}/custom-records?${params}`
      );
      if (!res.ok) throw new Error("Failed to fetch records");
      const json = (await res.json()) as {
        records: CustomRecord[];
        pagination: Pagination;
      };
      setRecords(json.records);
      setPagination(json.pagination);
    } catch {
      toast.error(t("table.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [chatbotId, schemaSlug, statusFilter, search, page, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetches remote records and updates the table state after the request resolves.
    void fetchRecords();
  }, [fetchRecords]);

  /* Reset page when filters change */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep pagination aligned with the selected filter set.
    setPage(1);
  }, [schemaSlug, statusFilter, search]);

  /* ───── Status update ───── */
  const updateStatus = async (recordId: string, status: StatusValue) => {
    setActionLoading(recordId);
    try {
      const res = await fetch(
        `/api/chatbots/${chatbotId}/custom-records/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, status } : r))
      );
      toast.success(t("table.statusUpdated"));
    } catch {
      toast.error(t("table.statusUpdateFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  /* ───── Delete ───── */
  const deleteRecord = async (recordId: string) => {
    setActionLoading(recordId);
    try {
      const res = await fetch(
        `/api/chatbots/${chatbotId}/custom-records/${recordId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      toast.success(t("table.recordDeleted"));
    } catch {
      toast.error(t("table.deleteFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  /* ───── Derived values ───── */
  const isFiltered =
    search.trim() !== "" || statusFilter !== "all";

  /* ───── Column definitions ───── */
  const allCols = [
    { key: "col_customer", label: t("table.customer") },
    { key: "col_phone", label: t("table.phone") },
    ...schemaFields.map((f, i) => ({
      key: `col_dynamic_${f.key || i}`,
      label: f.label,
    })),
    { key: "col_status", label: t("table.status") },
    { key: "col_date", label: t("table.date") },
    { key: "col_actions", label: t("table.actions") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("table.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "all")}>
            <SelectTrigger className="w-36 bg-background">
              <SelectValue placeholder={t("table.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("table.allStatuses")}</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`table.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchRecords()}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("table.refresh")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(records, schemaFields, { customer: t("table.customer"), phone: t("table.phone"), status: t("table.status"), date: t("table.date") }, isBengali)}
            disabled={records.length === 0}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("table.exportCsv")}</span>
          </Button>
        </div>
      </div>

      {/* ── Table container ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {allCols.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton cols={allCols.length} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={allCols.length}>
                    <EmptyState filtered={isFiltered} />
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {records.map((record, idx) => {
                    const cfg = STATUS_CONFIG[record.status];
                    const isActing = actionLoading === record.id;
                    return (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: idx * 0.02, duration: 0.2 }}
                        className={cn(
                          "border-b border-border last:border-0 transition-colors",
                          isActing
                            ? "opacity-50"
                            : "hover:bg-muted/30"
                        )}
                      >
                        {/* Customer */}
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          {record.customerName || (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                        {/* Phone with Quick Actions */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {record.customerPhone ? (
                            <div className="flex items-center gap-2">
                              <span>{record.customerPhone}</span>
                              <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                                <a
                                  href={`https://wa.me/${record.customerPhone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                  title={t("table.whatsappChat")}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`tel:${record.customerPhone}`}
                                  className="p-1 rounded-md text-blue-500 hover:bg-blue-500/10 transition-colors"
                                  title={t("table.directCall")}
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        {/* Dynamic fields */}
                        {schemaFields.map((field) => (
                          <td
                            key={field.key}
                            className="px-4 py-3 text-foreground max-w-[200px] truncate"
                            title={String(record.data[field.key] ?? "")}
                          >
                            {record.data[field.key] !== undefined &&
                            record.data[field.key] !== null
                              ? field.type === "boolean"
                                ? record.data[field.key]
                                  ? t("table.yes")
                                  : t("table.no")
                                : String(record.data[field.key])
                              : <span className="text-muted-foreground italic">—</span>}
                          </td>
                        ))}
                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-medium", cfg.classes)}
                          >
                            {t(`table.${record.status}`)}
                          </Badge>
                        </td>
                        {/* Date */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(record.createdAt).toLocaleDateString(isBengali ? "bn-BD" : "en-US")}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer"
                                  disabled={isActing}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-44">
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                {t("table.changeStatus")}
                              </div>
                              {STATUS_OPTIONS.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={() => void updateStatus(record.id, s)}
                                  className={cn(
                                    "cursor-pointer",
                                    record.status === s && "font-semibold text-primary"
                                  )}
                                >
                                  {t(`table.${s}`)}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void deleteRecord(record.id)}
                                className="cursor-pointer text-destructive focus:text-destructive gap-2"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t("table.deleteRecord")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("table.showing", {
                from: (pagination.page - 1) * pagination.limit + 1,
                to: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("table.previous")}</span>
              </Button>
              <span className="text-sm font-medium text-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={pagination.page >= pagination.totalPages}
                className="gap-1"
              >
                <span className="hidden sm:inline">{t("table.next")}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Total indicator (single page) ── */}
      {!loading && pagination.totalPages <= 1 && records.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {t("table.recordCount", { count: pagination.total })}
        </p>
      )}
    </div>
  );
}
