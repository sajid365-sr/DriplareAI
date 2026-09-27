"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ModelPaginationProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  onPageChange: (page: number) => void;
}

export function ModelPagination({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  onPageChange,
}: ModelPaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20">
      <div className="flex items-center gap-3">
        <span className="text-xs sm:text-sm text-muted-foreground font-medium">Rows per page:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
        >
          <SelectTrigger className="h-8 w-[75px] rounded-lg text-xs sm:text-sm border-primary/20 bg-background font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs sm:text-sm text-muted-foreground font-semibold">
        Showing {totalItems === 0 ? 0 : startIndex + 1} to{" "}
        {Math.min(startIndex + pageSize, totalItems)} of {totalItems} models
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous Page</span>
        </Button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(
            (page) =>
              page === 1 ||
              page === totalPages ||
              Math.abs(page - currentPage) <= 1
          )
          .map((page, idx, arr) => {
            const prevPage = arr[idx - 1];
            const showEllipsis = prevPage && page - prevPage > 1;

            return (
              <div key={page} className="flex items-center gap-1">
                {showEllipsis && <span className="text-xs text-muted-foreground px-1">…</span>}
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 text-xs sm:text-sm rounded-lg font-medium",
                    currentPage === page
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-background hover:bg-muted"
                  )}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              </div>
            );
          })}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next Page</span>
        </Button>
      </div>
    </div>
  );
}
