"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProductPaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
};

/**
 * Server-side pagination footer component.
 * Left: "Showing X to Y of Z products"
 * Right: Prev / page numbers / Next buttons
 */
export function ProductPagination({ meta, onPageChange }: ProductPaginationProps) {
  const { total, page, limit, totalPages } = meta;

  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Build page number list with ellipsis
  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-3.5 shadow-xs">
      {/* Left: Showing X to Y of Z */}
      <p className="text-xs text-muted-foreground font-medium shrink-0">
        Showing{" "}
        <span className="font-bold text-foreground">{from}</span>
        {" "}to{" "}
        <span className="font-bold text-foreground">{to}</span>
        {" "}of{" "}
        <span className="font-bold text-foreground">{total}</span>
        {" "}products
      </p>

      {/* Right: Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page Number Buttons */}
        {pageNumbers.map((p, idx) =>
          p === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                p === page
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border/60 bg-background text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              }`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Generates an array of page numbers with ellipsis for large ranges.
 * E.g. [1, 2, 3, "...", 10] or [1, "...", 4, 5, 6, "...", 10]
 */
function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  // Always show last page
  pages.push(total);

  return pages;
}
