"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";
import { FormField, SelectInput, TextInput } from "@/components/ui/form-controls";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { AdminHeaderNav } from "./admin-header-nav";

type AdminOrder = {
  order_id: string; buyer_id: string; buyer_email: string; shop_id: string; shop_name: string; status: string;
  total_amount: string; created_at: string;
  items: Array<{ order_item_id: string; product_name: string; variant_name: string; quantity: number; line_total: string }>;
  status_history: Array<{ history_id: string; old_status: string | null; new_status: string; reason: string | null; changed_at: string }>;
  payments: Array<{ payment_id: string; transaction_code: string | null; method: string; amount: string; status: string; paid_at: string | null }>;
  shipment: { carrier_name: string | null; tracking_code: string | null; status: string; updated_at: string } | null;
};
type Page = { data: AdminOrder[]; meta: { next_cursor: string | null; has_more: boolean; limit: number }; request_id: string };

const statusLabels: Record<string, string> = { PENDING_CONFIRMATION: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PREPARING: "Đang chuẩn bị", SHIPPING: "Đang giao", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy", DELIVERY_FAILED: "Giao thất bại" };

export function AdminOrdersScreen() {
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState({ status: "", search: "", from: "", to: "" });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState("");
  const [commandReason, setCommandReason] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);

  const load = useCallback(async (cursorToLoad: string | null = null) => {
    setLoading(true); setError(null);
    try {
      const params = { limit: 20, status: query.status || undefined, search: query.search || undefined, from: query.from || undefined, to: query.to || undefined, cursor: cursorToLoad ?? undefined };
      const page = await apiClient.getPaginated<AdminOrder>("/admin/orders", { params }) as unknown as Page;
      setRows(current => cursorToLoad ? [...current, ...page.data] : page.data);
      setNextCursor(page.meta.next_cursor); setHasMore(page.meta.has_more);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được danh sách đơn."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const filter = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNextCursor(null); setQuery({ status, search: search.trim(), from: from ? new Date(from).toISOString() : "", to: to ? new Date(to).toISOString() : "" }); };

  const openDetail = (order: AdminOrder) => { setSelected(order); setCommandStatus(order.status); setCommandReason(""); setCommandError(null); };
  const transition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !commandReason.trim()) return;
    setCommandBusy(true); setCommandError(null);
    try {
      await apiClient.patch(`/admin/orders/${selected.order_id}/transition`, { to: commandStatus, reason: commandReason.trim() });
      setSelected(await apiClient.get<AdminOrder>(`/admin/orders/${selected.order_id}`));
      setCommandReason("");
      await load();
    } catch (cause) { setCommandError(cause instanceof Error ? cause.message : "Cập nhật đơn hàng thất bại."); }
    finally { setCommandBusy(false); }
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <AdminHeaderNav currentModule="Đơn hàng toàn sàn" />
        <h1 className="page-title">Đơn hàng toàn sàn</h1>
        <p className="page-description">
          Tra cứu đơn, sản phẩm, thanh toán, vận chuyển và lịch sử thay đổi.
        </p>
      </div>
    </header>

    {/* Tabs */}
    <nav aria-label="Điều hướng đơn hàng & tài chính" className="border-b border-[var(--border)]">
      <div className="flex gap-6 text-sm font-semibold">
        <Link
          href="/admin/orders"
          className="pb-3 border-b-2 border-[var(--primary-active)] text-[var(--primary-active)]"
          aria-current="page"
        >
          Đơn hàng toàn sàn
        </Link>
        <Link
          href="/admin/finance"
          className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
        >
          Tài chính & Ví sàn
        </Link>
      </div>
    </nav>
    <form className="surface-card grid gap-4 p-4 sm:grid-cols-[minmax(220px,1fr)_220px_auto] sm:items-end" onSubmit={filter}>
      <FormField id="admin-order-search" label="Tìm mã đơn, shop hoặc email người mua"><TextInput id="admin-order-search" value={search} onChange={event => setSearch(event.target.value)} /></FormField>
      <FormField id="admin-order-status" label="Trạng thái"><SelectInput id="admin-order-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></FormField>
      <FormField id="admin-order-from" label="Từ ngày"><TextInput id="admin-order-from" type="datetime-local" value={from} onChange={event => setFrom(event.target.value)} /></FormField>
      <FormField id="admin-order-to" label="Đến ngày"><TextInput id="admin-order-to" type="datetime-local" value={to} onChange={event => setTo(event.target.value)} /></FormField>
      <Button type="submit">Lọc đơn hàng</Button>
    </form>
    {loading && rows.length === 0 ? <div className="space-y-3"><Skeleton height={42} /><Skeleton height={180} /></div> : error ? <ErrorState description={error} onRetry={() => void load()} /> : rows.length === 0 ? <EmptyState title="Không có đơn hàng phù hợp" description="Thử bỏ bớt bộ lọc hoặc tìm bằng mã đơn." /> :
      <section className="surface-card overflow-hidden" aria-label="Danh sách đơn hàng"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs uppercase text-[var(--subtext)]"><th className="p-3">Mã đơn</th><th className="p-3">Gian hàng</th><th className="p-3">Người mua</th><th className="p-3">Trạng thái</th><th className="p-3">Tổng tiền</th><th className="p-3">Tạo lúc</th><th className="p-3">Chi tiết</th></tr></thead><tbody>{rows.map(order => <tr className="border-b border-[var(--border)]" key={order.order_id}><td className="p-3 font-mono text-xs">{order.order_id}</td><td className="p-3">{order.shop_name}</td><td className="p-3 font-mono text-xs">{order.buyer_email}</td><td className="p-3">{statusLabels[order.status] ?? order.status}</td><td className="p-3 tabular-nums">{moneyAdapter.formatVND(order.total_amount)}</td><td className="p-3 whitespace-nowrap">{new Date(order.created_at).toLocaleString("vi-VN")}</td><td className="p-3"><Button variant="secondary" onClick={() => openDetail(order)}>Mở</Button></td></tr>)}</tbody></table></div>
        {hasMore && <div className="flex justify-center p-4"><Button variant="secondary" disabled={loading || !nextCursor} onClick={() => void load(nextCursor)}>{loading ? "Đang tải…" : "Tải thêm"}</Button></div>}
      </section>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }} title={`Đơn hàng ${selected?.order_id ?? ""}`} description={`${selected?.shop_name ?? ""} · ${statusLabels[selected?.status ?? ""] ?? selected?.status ?? ""}`}>
      {selected && <div className="max-h-[65vh] space-y-5 overflow-y-auto">
        <section><h2 className="mb-2 font-semibold">Sản phẩm</h2>{selected.items.map(item => <p className="border-b border-[var(--border)] py-2 text-sm" key={item.order_item_id}>{item.product_name} · {item.variant_name} × {item.quantity} <span className="float-right">{moneyAdapter.formatVND(item.line_total)}</span></p>)}</section>
        <section><h2 className="mb-2 font-semibold">Thanh toán</h2>{selected.payments.length ? selected.payments.map(payment => <p className="text-sm" key={payment.payment_id}>{payment.method} · {payment.status} · {moneyAdapter.formatVND(payment.amount)}{payment.transaction_code ? ` · ${payment.transaction_code}` : ""}</p>) : <p className="text-sm text-[var(--subtext)]">Chưa có giao dịch.</p>}</section>
        <section><h2 className="mb-2 font-semibold">Vận chuyển</h2><p className="text-sm">{selected.shipment ? `${selected.shipment.carrier_name ?? "Chưa có đơn vị vận chuyển"} · ${selected.shipment.status}${selected.shipment.tracking_code ? ` · ${selected.shipment.tracking_code}` : ""}` : "Chưa có thông tin vận chuyển."}</p></section>
        <section><h2 className="mb-2 font-semibold">Lịch sử</h2><ol className="space-y-2">{selected.status_history.map(entry => <li className="border-l-2 border-[var(--primary-border)] pl-3 text-sm" key={entry.history_id}><strong>{entry.old_status ?? "Tạo đơn"} → {entry.new_status}</strong><div className="text-xs text-[var(--subtext)]">{new Date(entry.changed_at).toLocaleString("vi-VN")}{entry.reason ? ` · ${entry.reason}` : ""}</div></li>)}</ol></section>
        <form className="space-y-3 border-t border-[var(--border)] pt-4" onSubmit={transition}>
          <h2 className="font-semibold">Can thiệp trạng thái</h2>
          <FormField id="admin-order-next-status" label="Trạng thái tiếp theo"><SelectInput id="admin-order-next-status" value={commandStatus} onChange={event => setCommandStatus(event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</SelectInput></FormField>
          <FormField id="admin-order-reason" label="Lý do xử lý" required><TextInput id="admin-order-reason" value={commandReason} onChange={event => setCommandReason(event.target.value)} required /></FormField>
          {commandError && <p role="alert" className="text-sm text-[var(--danger)]">{commandError}</p>}
          <Button type="submit" disabled={commandBusy || !commandReason.trim()}>{commandBusy ? "Đang lưu…" : "Áp dụng trạng thái"}</Button>
        </form>
      </div>}
    </Dialog>
  </main>;
}
