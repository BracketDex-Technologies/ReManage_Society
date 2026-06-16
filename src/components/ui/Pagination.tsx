"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-text-secondary">
        <span>
          Showing <span className="font-semibold text-text-primary">{start}–{end}</span> of{" "}
          <span className="font-semibold text-text-primary">{totalItems}</span> {itemLabel}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs whitespace-nowrap">
            Per page
          </label>
          <select
            id="page-size"
            className="select !w-auto !py-1.5 !px-2 !text-xs min-w-[4.5rem]"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm !px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm !px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1 mx-1">
            {pages.map((p, index) =>
              p === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 text-text-tertiary text-sm">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-[2rem] h-8 rounded-lg text-xs font-bold transition-colors ${
                    page === p ? "bg-primary text-white" : "text-text-secondary hover:bg-surface"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <span className="sm:hidden text-xs font-medium text-text-secondary px-2">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm !px-2"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm !px-2"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
