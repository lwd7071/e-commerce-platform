"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";
import { Dialog } from "@/components/ui/dialog";
import { FormField, SelectInput, TextInput } from "@/components/ui/form-controls";
import { AdminHeaderNav } from "./admin-header-nav";

type Voucher = { voucher_id: string; code: string; voucher_name: string; scope: "PLATFORM" | "SHOP"; shop_id: string | null; discount_type: "PERCENT" | "FIXED"; discount_value: string; max_discount: string | null; min_order_value: string; quantity: number; start_at: string; end_at: string; status: "ACTIVE" | "INACTIVE" };
type Draft = { code: string; voucher_name: string; discount_type: "PERCENT" | "FIXED"; discount_value: string; max_discount: string; min_order_value: string; quantity: string; start_at: string; end_at: string; reason: string };
const emptyDraft: Draft = { code: "", voucher_name: "", discount_type: "PERCENT", discount_value: "10", max_discount: "", min_order_value: "0", quantity: "1", start_at: "", end_at: "", reason: "" };

export function AdminVouchersScreen() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Voucher | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setVouchers(await apiClient.get<Voucher[]>("/admin/vouchers")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được voucher."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.reason.trim()) { setFormError("Vui lòng nhập lý do tạo voucher."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const payload = {
        ...draft, scope: "PLATFORM", shop_id: null, quantity: Number(draft.quantity),
        discount_value: draft.discount_value, max_discount: draft.max_discount || null,
        start_at: new Date(draft.start_at).toISOString(), end_at: new Date(draft.end_at).toISOString(), reason: draft.reason.trim(),
      };
      if (editingId) await apiClient.patch<Voucher>(`/admin/vouchers/${editingId}`, payload);
      else await apiClient.post<Voucher>("/admin/vouchers", payload);
      setDraft(emptyDraft);
      setEditingId(null);
      await load();
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Tạo voucher thất bại."); }
    finally { setSubmitting(false); }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.patch<Voucher>(`/admin/vouchers/${statusTarget.voucher_id}/status`, { status: statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", reason: reason.trim() });
      setStatusTarget(null); setReason(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cập nhật trạng thái thất bại."); }
    finally { setSubmitting(false); }
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AdminHeaderNav currentModule="Voucher toàn sàn" />
          <h1 className="page-title">Voucher toàn sàn</h1>
          <p className="page-description">Voucher nền tảng do Admin quản lý; voucher shop chỉ xem.</p>
        </div>
      </header>
      <form className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
        <h2 className="text-base font-semibold sm:col-span-2 lg:col-span-4">{editingId ? "Sửa voucher PLATFORM" : "Tạo voucher PLATFORM"}</h2>
        <FormField id="voucher-code" label="Mã voucher" required><TextInput id="voucher-code" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} required maxLength={50} /></FormField>
        <FormField id="voucher-name" label="Tên voucher" required><TextInput id="voucher-name" value={draft.voucher_name} onChange={e => setDraft({ ...draft, voucher_name: e.target.value })} required maxLength={150} /></FormField>
        <FormField id="voucher-type" label="Loại giảm"><SelectInput id="voucher-type" value={draft.discount_type} onChange={e => setDraft({ ...draft, discount_type: e.target.value as Draft["discount_type"] })}><option value="PERCENT">Phần trăm</option><option value="FIXED">Số tiền</option></SelectInput></FormField>
        <FormField id="voucher-value" label="Giá trị giảm" required><TextInput id="voucher-value" inputMode="decimal" value={draft.discount_value} onChange={e => setDraft({ ...draft, discount_value: e.target.value })} required /></FormField>
        <FormField id="voucher-max" label="Giảm tối đa"><TextInput id="voucher-max" inputMode="decimal" value={draft.max_discount} onChange={e => setDraft({ ...draft, max_discount: e.target.value })} /></FormField>
        <FormField id="voucher-min" label="Giá trị đơn tối thiểu"><TextInput id="voucher-min" inputMode="decimal" value={draft.min_order_value} onChange={e => setDraft({ ...draft, min_order_value: e.target.value })} required /></FormField>
        <FormField id="voucher-quantity" label="Số lượt"><TextInput id="voucher-quantity" type="number" min="0" step="1" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: e.target.value })} required /></FormField>
        <FormField id="voucher-start" label="Bắt đầu" required><TextInput id="voucher-start" type="datetime-local" value={draft.start_at} onChange={e => setDraft({ ...draft, start_at: e.target.value })} required /></FormField>
        <FormField id="voucher-end" label="Kết thúc" required><TextInput id="voucher-end" type="datetime-local" value={draft.end_at} onChange={e => setDraft({ ...draft, end_at: e.target.value })} required /></FormField>
        <FormField id="voucher-reason" label="Lý do tạo" required><TextInput id="voucher-reason" value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value })} required /></FormField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={submitting}>{submitting ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Tạo voucher nền tảng"}</Button>{editingId && <Button type="button" variant="secondary" disabled={submitting} onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>Hủy sửa</Button>}{formError && <p role="alert" className="text-sm text-[var(--danger)]">{formError}</p>}</div>
      </form>
      {loading ? <div className="space-y-3"><Skeleton height={44} /><Skeleton height={180} /></div> : error ? <ErrorState description={error} onRetry={() => void load()} /> : vouchers.length === 0 ? <EmptyState title="Chưa có voucher" description="Voucher hiện có sẽ xuất hiện tại đây." /> :
        <section className="surface-card overflow-hidden" aria-label="Danh sách voucher"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs uppercase text-[var(--subtext)]"><th className="p-3">Mã</th><th className="p-3">Voucher</th><th className="p-3">Phạm vi</th><th className="p-3">Giảm</th><th className="p-3">Lượt còn</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{vouchers.map(v => <tr key={v.voucher_id} className="border-b border-[var(--border)]"><td className="p-3 font-mono">{v.code}</td><td className="p-3">{v.voucher_name}</td><td className="p-3">{v.scope === "PLATFORM" ? "Toàn sàn" : "Shop"}</td><td className="p-3">{v.discount_type === "PERCENT" ? `${v.discount_value}%` : `${v.discount_value} ₫`}</td><td className="p-3 tabular-nums">{v.quantity}</td><td className="p-3">{v.status === "ACTIVE" ? "Đang bật" : "Đã tắt"}</td><td className="p-3"><div className="flex gap-2">{v.scope === "PLATFORM" && <><Button variant="secondary" disabled={submitting} onClick={() => { setEditingId(v.voucher_id); setDraft({ code: v.code, voucher_name: v.voucher_name, discount_type: v.discount_type, discount_value: v.discount_value, max_discount: v.max_discount ?? "", min_order_value: v.min_order_value, quantity: String(v.quantity), start_at: toLocalInput(v.start_at), end_at: toLocalInput(v.end_at), reason: "" }); }}>{"Sửa"}</Button><Button variant="secondary" disabled={submitting} onClick={() => { setStatusTarget(v); setReason(""); }}>{v.status === "ACTIVE" ? "Tắt" : "Bật"}</Button></>}</div></td></tr>)}</tbody></table></div></section>}
      <Dialog open={Boolean(statusTarget)} onOpenChange={open => { if (!open) setStatusTarget(null); }} title={statusTarget?.status === "ACTIVE" ? "Tắt voucher" : "Bật voucher"} description="Nhập lý do để lưu cùng nhật ký Admin.">
        <div className="space-y-4"><FormField id="voucher-status-reason" label="Lý do" required><TextInput id="voucher-status-reason" value={reason} onChange={e => setReason(e.target.value)} required autoFocus /></FormField><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setStatusTarget(null)}>Hủy</Button><Button disabled={!reason.trim() || submitting} onClick={() => void changeStatus()}>{submitting ? "Đang lưu…" : "Xác nhận"}</Button></div></div>
      </Dialog>
    </main>;
}

function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
