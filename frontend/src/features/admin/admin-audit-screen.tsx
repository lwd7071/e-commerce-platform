"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import type { PaginatedEnvelope } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/data-states";
import { FormField, SelectInput, TextInput } from "@/components/ui/form-controls";
import { AdminHeaderNav } from "./admin-header-nav";
import { Pagination, type PageMeta } from "@/components/ui/pagination";

type AuditLog = { id: string; action: string; targetType: string | null; targetId: string | null; reason: string; actor: string; createdAt: string };
const targets = ["USER", "SHOP", "PRODUCT", "REVIEW", "ORDER", "CATEGORY", "VOUCHER", "CAMPAIGN"];
const targetLink: Record<string, string> = { USER: "/admin", SHOP: "/admin/shops", PRODUCT: "/admin", REVIEW: "/admin/reviews", ORDER: "/admin/orders", CATEGORY: "/admin/categories", VOUCHER: "/admin/vouchers", CAMPAIGN: "/admin/campaigns" };

export function AdminAuditScreen() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState({ action: "", target_type: "", actor: "", from: "", to: "" });
  const [pageMeta, setPageMeta] = useState<PageMeta>({ page: 1, page_size: 20, total_items: 0, total_pages: 1 });
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pageNumber, page_size: 20, ...filters, from: filters.from ? new Date(filters.from).toISOString() : undefined, to: filters.to ? new Date(filters.to).toISOString() : undefined };
      const page = await apiClient.getPaginated<AuditLog>("/admin/audit-logs", { params }) as unknown as PaginatedEnvelope<AuditLog>;
      setRows(page.data);
      setPageMeta({ page: page.meta.page ?? pageNumber, page_size: page.meta.page_size ?? 20, total_items: page.meta.total_items ?? page.data.length, total_pages: page.meta.total_pages ?? 1 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được nhật ký quản trị.");
    } finally { setLoading(false); }
  }, [filters, pageNumber]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ action: action.trim(), target_type: targetType, actor: actor.trim(), from, to });
    setPageNumber(1);
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <AdminHeaderNav currentModule="Nhật ký quản trị" />
        <h1 className="page-title">Nhật ký quản trị</h1>
        <p className="page-description">Tra cứu người thực hiện, thao tác, đối tượng và thời gian.</p>
      </div>
    </header>
    <form onSubmit={submit} className="surface-card grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
      <FormField id="audit-action" label="Hành động"><TextInput id="audit-action" className="w-full min-w-0" value={action} onChange={(event) => setAction(event.target.value)} /></FormField>
      <FormField id="audit-target" label="Loại đối tượng"><SelectInput id="audit-target" className="w-full min-w-0" value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="">Tất cả</option>{targets.map((target) => <option key={target} value={target}>{target}</option>)}</SelectInput></FormField>
      <FormField id="audit-actor" label="Admin ID"><TextInput id="audit-actor" className="w-full min-w-0" value={actor} onChange={(event) => setActor(event.target.value)} /></FormField>
      <FormField id="audit-from" label="Từ thời điểm"><TextInput id="audit-from" className="w-full min-w-0" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} /></FormField>
      <FormField id="audit-to" label="Đến thời điểm"><TextInput id="audit-to" className="w-full min-w-0" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} /></FormField>
      <div className="flex justify-end xl:col-span-3"><Button type="submit" disabled={loading}>Lọc nhật ký</Button></div>
    </form>
    {error && <div role="alert"><ErrorState title="Nhật ký chưa tải được" description={error} onRetry={() => void load()} /></div>}
    {loading && rows.length === 0 && <Skeleton height={160} />}
    {!loading && !error && rows.length === 0 && <section className="surface-card p-8 text-center text-sm text-[var(--subtext)]">Không có nhật ký phù hợp.</section>}
    {rows.length > 0 && <section className="surface-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--subtext)]"><th scope="col" className="p-3">Thời gian</th><th scope="col" className="p-3">Hành động</th><th scope="col" className="p-3">Đối tượng</th><th scope="col" className="p-3">Lý do</th><th scope="col" className="p-3">Người thực hiện</th></tr></thead><tbody>{rows.map((log) => <tr className="border-b border-[var(--border)] align-top" key={log.id}><td className="whitespace-nowrap p-3">{new Date(log.createdAt).toLocaleString("vi-VN")}</td><td className="p-3 font-semibold">{log.action}</td><td className="p-3"><details><summary className="cursor-pointer">{log.targetType ?? "—"} · {log.targetId ?? "—"}</summary><p className="mt-2 text-xs">ID: {log.targetId ?? "—"}</p>{log.targetType && targetLink[log.targetType] && <Link className="mt-2 inline-block text-[var(--primary)] underline" href={targetLink[log.targetType]}>Mở đối tượng</Link>}</details></td><td className="max-w-sm whitespace-pre-wrap p-3">{log.reason || "—"}</td><td className="p-3">{log.actor}</td></tr>)}</tbody></table></div>
      <Pagination meta={pageMeta} onPageChange={setPageNumber} disabled={loading} />
    </section>}
  </main>;
}
