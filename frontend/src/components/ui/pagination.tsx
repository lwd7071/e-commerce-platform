"use client";

import { Button } from "./button";

export type PageMeta = { page: number; page_size: number; total_items: number; total_pages: number };

export function Pagination({ meta, onPageChange, disabled = false }: { meta: PageMeta; onPageChange: (page: number) => void; disabled?: boolean }) {
  if (meta.total_pages <= 1) return null;
  const start = Math.max(1, Math.min(meta.page - 2, meta.total_pages - 4));
  const pages = Array.from({ length: Math.min(5, meta.total_pages) }, (_, index) => start + index);
  return <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3" aria-label="Phân trang">
    <p className="text-sm text-[var(--subtext)]" aria-live="polite">Trang <strong className="text-[var(--foreground)]">{meta.page}</strong> / {meta.total_pages} · {meta.total_items.toLocaleString("vi-VN")} bản ghi</p>
    <div className="flex items-center gap-1">
      <Button type="button" variant="secondary" disabled={disabled || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>Trước</Button>
      {pages.map(page => <Button key={page} type="button" variant={page === meta.page ? "primary" : "secondary"} aria-current={page === meta.page ? "page" : undefined} disabled={disabled || page === meta.page} onClick={() => onPageChange(page)} className="min-w-10">{page}</Button>)}
      <Button type="button" variant="secondary" disabled={disabled || meta.page >= meta.total_pages} onClick={() => onPageChange(meta.page + 1)}>Tiếp</Button>
    </div>
  </nav>;
}
