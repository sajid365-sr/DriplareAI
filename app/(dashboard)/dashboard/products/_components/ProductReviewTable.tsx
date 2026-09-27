"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Check, Pencil, Trash2, Package } from "lucide-react";
import type { ExtractedProduct } from "@/lib/ai/product-extract";

// ─── Draft row type ───────────────────────────────────────────────────────────

type DraftRow = ExtractedProduct & {
  keep: boolean;
  editing: boolean;
};

type ProductReviewTableProps = {
  drafts: ExtractedProduct[];
  busy: boolean;
  onSave: (products: ExtractedProduct[]) => void;
  onCancel: () => void;
};

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Step 3 of the sync wizard.
 * Shows extracted products in an editable table.
 * User can toggle, edit inline, and save selected products.
 */
export function ProductReviewTable({ drafts, busy, onSave, onCancel }: ProductReviewTableProps) {
  const { t } = useTranslation("products");

  const [rows, setRows] = useState<DraftRow[]>(
    drafts.map((d) => ({ ...d, keep: true, editing: false }))
  );

  const keptCount = rows.filter((r) => r.keep).length;
  const totalCount = rows.length;

  function toggleAll(value: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, keep: value })));
  }

  function toggleRow(i: number) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, keep: !r.keep } : r)));
  }

  function toggleEdit(i: number) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, editing: !r.editing } : r)));
  }

  function updateRow<K extends keyof DraftRow>(i: number, key: K, value: DraftRow[K]) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }

  function deleteRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  function handleSave() {
    const kept: ExtractedProduct[] = rows
      .filter((r) => r.keep)
      .map(({ keep: _keep, editing: _editing, ...product }) => product);
    onSave(kept);
  }

  // Empty state
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Sparkles className="h-7 w-7" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("sync.noProducts")}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t("sync.cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">{t("sync.reviewTitle")}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("sync.reviewSubtitle", { count: totalCount })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            {t("sync.selectAll")}
          </button>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            disabled={keptCount === 0}
            className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            {t("sync.deselectAll")}
          </button>
        </div>
      </div>

      {/* Responsive table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-10">
                <span className="sr-only">{t("sync.columns.select")}</span>
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-16">
                {t("sync.columns.image")}
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                {t("sync.columns.name")}
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-28">
                {t("sync.columns.price")}
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-32 hidden md:table-cell">
                {t("sync.columns.colors")}
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-32 hidden md:table-cell">
                {t("sync.columns.sizes")}
              </th>
              <th className="px-3 py-3 text-center font-medium text-muted-foreground w-24">
                {t("sync.columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row, i) => (
              <ProductTableRow
                key={i}
                row={row}
                index={i}
                onToggle={() => toggleRow(i)}
                onToggleEdit={() => toggleEdit(i)}
                onUpdate={(key, value) => updateRow(i, key, value)}
                onDelete={() => deleteRow(i)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {t("sync.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || keptCount === 0}
          className="rounded-xl bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("sync.saving") : t("sync.saveButton", { count: keptCount })}
        </button>
      </div>
    </div>
  );
}

// ─── ProductTableRow ──────────────────────────────────────────────────────────

type ProductTableRowProps = {
  row: DraftRow;
  index: number;
  onToggle: () => void;
  onToggleEdit: () => void;
  onUpdate: <K extends keyof DraftRow>(key: K, value: DraftRow[K]) => void;
  onDelete: () => void;
};

function ProductTableRow({ row, onToggle, onToggleEdit, onUpdate, onDelete }: ProductTableRowProps) {
  const { t } = useTranslation("products");

  const colors = row.variants?.colors ?? [];
  const sizes = row.variants?.sizes ?? [];

  function handleVariantChange(key: "colors" | "sizes", raw: string) {
    const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
    onUpdate("variants", { ...(row.variants ?? {}), [key]: arr });
  }

  return (
    <tr className={`transition-colors ${row.keep ? "bg-card" : "bg-muted/30 opacity-60"}`}>
      {/* Checkbox */}
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={row.keep}
          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
            row.keep
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary/50"
          }`}
        >
          {row.keep && <Check className="h-3 w-3" />}
        </button>
      </td>

      {/* Image */}
      <td className="px-3 py-3">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt={row.name}
            className="h-12 w-12 rounded-lg object-cover border border-border/40"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </td>

      {/* Name + description */}
      <td className="px-3 py-3">
        {row.editing ? (
          <div className="space-y-1.5">
            <input
              className={inputCls}
              value={row.name}
              placeholder="Product name"
              onChange={(e) => onUpdate("name", e.target.value)}
            />
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={row.description ?? ""}
              placeholder="Description..."
              onChange={(e) => onUpdate("description", e.target.value || null)}
            />
          </div>
        ) : (
          <div>
            <p className="font-semibold text-foreground leading-tight">{row.name}</p>
            {row.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {row.description}
              </p>
            )}
          </div>
        )}
      </td>

      {/* Price */}
      <td className="px-3 py-3">
        {row.editing ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">৳</span>
            <input
              className={`${inputCls} w-24`}
              type="number"
              value={row.price ?? ""}
              placeholder="0"
              onChange={(e) => onUpdate("price", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        ) : row.price ? (
          <span className="font-bold text-success text-sm">
            ৳ {row.price.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Colors */}
      <td className="px-3 py-3 hidden md:table-cell">
        {row.editing ? (
          <input
            className={`${inputCls} w-28`}
            value={colors.join(", ")}
            placeholder="White, Blue..."
            onChange={(e) => handleVariantChange("colors", e.target.value)}
          />
        ) : colors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {colors.map((c, ci) => (
              <span
                key={ci}
                className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Sizes */}
      <td className="px-3 py-3 hidden md:table-cell">
        {row.editing ? (
          <input
            className={`${inputCls} w-28`}
            value={sizes.join(", ")}
            placeholder="S, M, L..."
            onChange={(e) => handleVariantChange("sizes", e.target.value)}
          />
        ) : sizes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sizes.map((s, si) => (
              <span
                key={si}
                className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onToggleEdit}
            title={t(row.editing ? "sync.cancel" : "editModal.save")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Remove from list"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
