"use client";

import { useState } from 'react';
import Link from 'next/link';
import { repositories } from '@/lib/repositories/repository-factory';
import type { SellerRevenueReport } from '@/lib/api/seller-report.api';
import { moneyAdapter } from '@/lib/adapters/money.adapter';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/data-states';
import { FormField, TextInput } from '@/components/ui/form-controls';

export function SellerReportsScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<SellerRevenueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true); setError(null);
    try {
      const filter = {
        ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
        ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
      };
      setReport(await repositories.seller().getRevenueReport(filter));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải báo cáo doanh thu.'); }
    finally { setLoading(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
    <header className="space-y-2"><Link href="/seller" className="text-sm font-medium text-[var(--primary)]">← Kênh người bán</Link><h1 className="text-2xl font-bold text-[var(--foreground)]">Báo cáo doanh thu</h1><p className="text-sm text-[var(--subtext)]">Chỉ đơn đã hoàn tất được tính vào doanh thu theo QD19. Dữ liệu luôn lấy từ gian hàng của phiên đăng nhập.</p></header>
    <form onSubmit={(event) => void load(event)} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <FormField id="report-from" label="Từ ngày"><TextInput id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></FormField>
      <FormField id="report-to" label="Đến ngày"><TextInput id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></FormField>
      <Button type="submit" disabled={loading}>{loading ? 'Đang tải…' : 'Xem báo cáo'}</Button>
    </form>
    {error && <ErrorState title="Không tải được báo cáo" description={error} onRetry={() => void load()} />}
    {loading && <div className="grid gap-4 sm:grid-cols-3"><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /></div>}
    {!loading && report && <section className="space-y-4" aria-label="Kết quả doanh thu">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-sm text-[var(--subtext)]">Doanh thu đơn hoàn tất</p><p className="mt-2 text-2xl font-bold">{moneyAdapter.formatVND(report.grossRevenue)}</p></article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-sm text-[var(--subtext)]">Đơn hoàn tất</p><p className="mt-2 text-2xl font-bold">{report.completedOrders}</p></article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-sm text-[var(--subtext)]">Giá trị đơn trung bình</p><p className="mt-2 text-2xl font-bold">{moneyAdapter.formatVND(report.averageOrderValue)}</p></article>
        <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-sm text-[var(--subtext)]">Tổng đơn trong kỳ</p><p className="mt-2 text-2xl font-bold">{report.totalOrders}</p><p className="mt-1 text-xs text-[var(--subtext)]">{report.cancelledOrders} đã hủy · {report.otherOrders} trạng thái khác</p></article>
      </div>
      <p className="text-xs text-[var(--subtext)]">Cập nhật lúc {new Date(report.generatedAt).toLocaleString('vi-VN')}</p>
    </section>}
  </main>;
}
