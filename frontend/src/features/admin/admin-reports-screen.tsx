"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { ErrorState } from "@/components/ui/data-states";

type Report = {
  from: string;
  to: string;
  ordersByStatus: Array<{ status: string; count: number }>;
  dailyGmv: Array<{ date: string; orderCount: number; gmv: string }>;
  topShops: Array<{ name: string; orderCount: number; gmv: string }>;
  topProducts: Array<{ name: string; quantitySold: number; gmv: string }>;
  moderationActions: Array<{ action: string; count: number }>;
};

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
const monthAgo = new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

export function AdminReportsScreen() {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<Report>("/admin/reports", { params: { from, to } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="eyebrow">Dino Control Center</p>
        <h1 className="page-title">Báo cáo vận hành</h1>
        <p className="page-description">GMV chỉ tính đơn hoàn tất; ngày báo cáo theo múi giờ Việt Nam.</p>
      </header>
      <form onSubmit={load} className="surface-card grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField id="report-from" label="Từ ngày"><TextInput id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></FormField>
        <FormField id="report-to" label="Đến ngày"><TextInput id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></FormField>
        <Button type="submit" loading={loading}>Xem báo cáo</Button>
      </form>
      {error && <div role="alert"><ErrorState title="Báo cáo chưa tải được" description={error} onRetry={() => void load()} /></div>}
      {!report && !loading && !error && <p className="text-sm text-[var(--subtext)]">Chọn khoảng ngày để xem báo cáo.</p>}
      {report && <div className="grid gap-5 lg:grid-cols-2">
        <ReportTable title="Đơn theo trạng thái" headers={["Trạng thái", "Số đơn"]} rows={report.ordersByStatus.map((row) => [row.status, String(row.count)])} />
        <DailyGmvReport rows={report.dailyGmv} />
        <ReportTable title="Top gian hàng" headers={["Gian hàng", "Đơn hoàn tất", "GMV"]} rows={report.topShops.map((row) => [row.name, String(row.orderCount), row.gmv])} />
        <ReportTable title="Top sản phẩm" headers={["Sản phẩm", "Đã bán", "GMV"]} rows={report.topProducts.map((row) => [row.name, String(row.quantitySold), row.gmv])} />
        <ReportTable title="Lượt xử lý kiểm duyệt" headers={["Hành động", "Số lượt"]} rows={report.moderationActions.map((row) => [row.action, String(row.count)])} />
      </div>}
    </section>
  );
}

function DailyGmvReport({ rows }: { rows: Report["dailyGmv"] }) {
  const max = Math.max(0, ...rows.map((row) => Number(row.gmv)));
  return <section className="surface-card overflow-hidden" aria-label="GMV và số đơn theo ngày">
    <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">GMV và số đơn theo ngày</h2>
    {rows.length > 0 && <div role="img" aria-label="Biểu đồ cột GMV hoàn tất theo ngày, ngày tính theo giờ Việt Nam" className="space-y-2 px-4 py-4">
      {rows.map((row) => <div key={row.date} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
        <span>{row.date}</span><div className="h-3 rounded bg-[var(--card-muted)]"><div className="h-full rounded bg-[var(--primary)]" style={{ width: `${max > 0 ? Math.max(2, Number(row.gmv) / max * 100) : 0}%` }} /></div><span className="tabular-nums">{row.gmv}</span>
      </div>)}
    </div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Bảng dữ liệu tương đương biểu đồ GMV</caption><thead><tr>{["Ngày (VN)", "Số đơn", "GMV hoàn tất"].map((header) => <th key={header} scope="col" className="px-4 py-2 text-xs text-[var(--subtext)]">{header}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.date} className="border-t border-[var(--border)]"><td className="px-4 py-2">{row.date}</td><td className="px-4 py-2 tabular-nums">{row.orderCount}</td><td className="px-4 py-2 tabular-nums">{row.gmv}</td></tr>) : <tr><td colSpan={3} className="px-4 py-4 text-sm text-[var(--subtext)]">Không có dữ liệu trong khoảng ngày này.</td></tr>}</tbody>
    </table></div>
  </section>;
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="surface-card overflow-hidden" aria-label={title}>
    <h2 className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold">{title}</h2>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-2 text-xs text-[var(--subtext)]">{header}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-[var(--border)]">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-2 tabular-nums">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-4 py-4 text-sm text-[var(--subtext)]">Không có dữ liệu trong khoảng ngày này.</td></tr>}</tbody>
    </table></div>
  </section>;
}
