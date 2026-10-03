"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sellerVoucherApi, type SellerVoucher, type SellerVoucherInput } from '@/lib/api/seller-voucher.api';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/data-states';
import { FormField, SelectInput, TextInput } from '@/components/ui/form-controls';
import { moneyAdapter } from '@/lib/adapters/money.adapter';

const emptyForm: SellerVoucherInput = {
  code: '', voucher_name: '', discount_type: 'PERCENT', discount_value: '', max_discount: null,
  min_order_value: '0.00', quantity: 1, start_at: '', end_at: '',
};

function localDateTime(value: string) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function SellerVouchersScreen() {
  const [vouchers, setVouchers] = useState<SellerVoucher[]>([]);
  const [form, setForm] = useState<SellerVoucherInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setVouchers(await sellerVoucherApi.list()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được voucher của gian hàng.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resetForm() { setEditingId(null); setForm(emptyForm); setMessage(null); setError(null); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    const payload = { ...form, code: form.code.trim().toUpperCase(), start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString() };
    try {
      if (editingId) await sellerVoucherApi.update(editingId, payload);
      else await sellerVoucherApi.create(payload);
      resetForm(); setMessage(editingId ? 'Đã cập nhật voucher.' : 'Đã tạo voucher cho gian hàng.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được voucher.'); }
    finally { setSaving(false); }
  }

  async function edit(voucher: SellerVoucher) {
    setEditingId(voucher.voucher_id);
    setForm({ code: voucher.code, voucher_name: voucher.voucher_name, discount_type: voucher.discount_type, discount_value: voucher.discount_value, max_discount: voucher.max_discount, min_order_value: voucher.min_order_value, quantity: voucher.quantity, start_at: localDateTime(voucher.start_at), end_at: localDateTime(voucher.end_at) });
    document.getElementById('voucher-code')?.focus();
  }

  async function toggle(voucher: SellerVoucher) {
    setError(null); setMessage(null);
    try {
      const updated = await sellerVoucherApi.setStatus(voucher.voucher_id, voucher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      setVouchers((items) => items.map((item) => item.voucher_id === updated.voucher_id ? updated : item));
      setMessage(updated.status === 'ACTIVE' ? 'Đã bật voucher.' : 'Đã tắt voucher.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đổi được trạng thái voucher.'); }
  }

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
    <header className="space-y-2">
      <Link href="/seller" className="text-sm font-medium text-[var(--primary)]">← Kênh người bán</Link>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Voucher gian hàng</h1>
      <p className="text-sm text-[var(--subtext)]">Voucher được gắn với gian hàng hiện tại. Voucher đã có lượt sử dụng chỉ có thể bật hoặc tắt; muốn đổi điều kiện hãy tạo voucher mới.</p>
    </header>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {message && <p className="notice notice--success" role="status">{message}</p>}
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7" aria-labelledby="voucher-form-title">
      <h2 id="voucher-form-title" className="mb-5 text-lg font-semibold">{editingId ? 'Sửa điều kiện voucher' : 'Tạo voucher mới'}</h2>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4 sm:grid-cols-2">
        <FormField id="voucher-code" label="Mã voucher" required><TextInput id="voucher-code" required maxLength={50} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} disabled={saving} /></FormField>
        <FormField id="voucher-name" label="Tên voucher" required><TextInput id="voucher-name" required maxLength={150} value={form.voucher_name} onChange={(event) => setForm({ ...form, voucher_name: event.target.value })} disabled={saving} /></FormField>
        <FormField id="voucher-discount-type" label="Kiểu giảm" required><SelectInput id="voucher-discount-type" value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value as SellerVoucherInput['discount_type'] })} disabled={saving}><option value="PERCENT">Phần trăm</option><option value="FIXED">Số tiền cố định</option></SelectInput></FormField>
        <FormField id="voucher-discount-value" label={form.discount_type === 'PERCENT' ? 'Phần trăm giảm' : 'Số tiền giảm'} required><TextInput id="voucher-discount-value" type="number" min="0.01" max={form.discount_type === 'PERCENT' ? '100' : undefined} step="0.01" required value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} disabled={saving} /></FormField>
        <FormField id="voucher-max-discount" label="Mức giảm tối đa" helpText="Để trống nếu không giới hạn."><TextInput id="voucher-max-discount" type="number" min="0" step="0.01" value={form.max_discount ?? ''} onChange={(event) => setForm({ ...form, max_discount: event.target.value || null })} disabled={saving} /></FormField>
        <FormField id="voucher-min-order" label="Giá trị đơn tối thiểu" required><TextInput id="voucher-min-order" type="number" min="0" step="0.01" required value={form.min_order_value} onChange={(event) => setForm({ ...form, min_order_value: event.target.value })} disabled={saving} /></FormField>
        <FormField id="voucher-quantity" label="Số lượt còn lại" required><TextInput id="voucher-quantity" type="number" min="0" step="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={saving} /></FormField>
        <FormField id="voucher-start" label="Bắt đầu" required><TextInput id="voucher-start" type="datetime-local" required value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} disabled={saving} /></FormField>
        <FormField id="voucher-end" label="Kết thúc" required><TextInput id="voucher-end" type="datetime-local" required value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} disabled={saving} /></FormField>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">{editingId && <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Bỏ sửa</Button>}<Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo voucher'}</Button></div>
      </form>
    </section>
    <section aria-label="Voucher đã tạo">
      <h2 className="mb-3 text-lg font-semibold">Voucher của gian hàng</h2>
      {loading ? <div className="space-y-3"><Skeleton height={56} /><Skeleton height={56} /></div>
        : vouchers.length === 0 ? <EmptyState icon="bag" title="Chưa có voucher" description="Tạo voucher đầu tiên để áp dụng ưu đãi cho đơn hàng tại gian hàng này." />
        : <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--subtext)]"><th className="p-3">Mã / Tên</th><th className="p-3">Ưu đãi</th><th className="p-3">Còn lại</th><th className="p-3">Thời hạn</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{vouchers.map((voucher) => <tr key={voucher.voucher_id} className="border-b border-[var(--border)] last:border-0"><td className="p-3"><strong>{voucher.code}</strong><span className="block text-xs text-[var(--subtext)]">{voucher.voucher_name}</span></td><td className="p-3">{voucher.discount_type === 'PERCENT' ? `${voucher.discount_value}%` : moneyAdapter.formatVND(voucher.discount_value)}<span className="block text-xs text-[var(--subtext)]">Đơn từ {moneyAdapter.formatVND(voucher.min_order_value)}</span></td><td className="p-3">{voucher.quantity}</td><td className="p-3 text-xs">{new Date(voucher.start_at).toLocaleDateString('vi-VN')} – {new Date(voucher.end_at).toLocaleDateString('vi-VN')}</td><td className="p-3">{voucher.status === 'ACTIVE' ? 'Đang bật' : 'Đã tắt'}</td><td className="p-3"><div className="flex gap-2"><Button variant="secondary" onClick={() => void edit(voucher)} disabled={saving}>Sửa</Button><Button variant="ghost" onClick={() => void toggle(voucher)}>{voucher.status === 'ACTIVE' ? 'Tắt' : 'Bật'}</Button></div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
