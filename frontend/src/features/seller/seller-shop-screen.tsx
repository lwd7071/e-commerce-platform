"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sellerShopApi, type SellerShopProfile, type UpdateSellerShop } from '@/lib/api/seller-shop.api';
import { Button } from '@/components/ui/button';
import { FormField, TextArea, TextInput } from '@/components/ui/form-controls';
import { ErrorState, Skeleton } from '@/components/ui/data-states';

export function SellerShopScreen() {
  const [shop, setShop] = useState<SellerShopProfile | null>(null);
  const [form, setForm] = useState<UpdateSellerShop>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const profile = await sellerShopApi.get();
      setShop(profile);
      setForm({ shop_name: profile.shop_name, description: profile.description ?? '', pickup_address: profile.pickup_address ?? '', contact_phone: profile.contact_phone ?? '' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ gian hàng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await sellerShopApi.update(form);
      setShop(updated);
      setForm({ shop_name: updated.shop_name, description: updated.description ?? '', pickup_address: updated.pickup_address ?? '', contact_phone: updated.contact_phone ?? '' });
      setNotice('Đã lưu hồ sơ gian hàng.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ gian hàng.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl space-y-4 px-4 py-8"><Skeleton height={52} /><Skeleton height={280} /></main>;
  if (error && !shop) return <main className="mx-auto max-w-3xl px-4 py-8"><ErrorState title="Không tải được hồ sơ gian hàng" description={error} onRetry={() => void load()} /></main>;
  if (!shop) return null;

  const canEdit = shop.status === 'PENDING' || shop.status === 'ACTIVE';
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/seller" className="text-sm font-medium text-[var(--primary)]">← Kênh người bán</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold text-[var(--foreground)]">Hồ sơ gian hàng</h1><p className="mt-1 text-sm text-[var(--subtext)]">Địa chỉ nhận hàng ở đây dùng cho vận hành đơn bán; đây không phải sổ địa chỉ giao hàng của người mua.</p></div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm" aria-label={`Trạng thái gian hàng: ${shop.status}`}>{shop.status}</span>
        </div>
      </header>
      {shop.status === 'PENDING' && <p className="notice notice--warning" role="status">Hãy điền địa chỉ nhận hàng và số điện thoại liên hệ để Admin có thể duyệt gian hàng.</p>}
      {!canEdit && <p className="notice" role="status">Hồ sơ đang ở chế độ chỉ xem trong trạng thái hiện tại.</p>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {notice && <p className="notice notice--success" role="status">{notice}</p>}
      <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <FormField id="shop-name" label="Tên gian hàng" required><TextInput id="shop-name" required minLength={2} maxLength={150} value={form.shop_name ?? ''} onChange={(event) => setForm({ ...form, shop_name: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <FormField id="shop-description" label="Mô tả"><TextArea id="shop-description" rows={4} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <FormField id="pickup-address" label="Địa chỉ nhận hàng" required helpText="Dùng làm địa chỉ lấy hàng cho các đơn thuộc gian hàng này."><TextInput id="pickup-address" required maxLength={255} autoComplete="street-address" value={form.pickup_address ?? ''} onChange={(event) => setForm({ ...form, pickup_address: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <FormField id="contact-phone" label="Số điện thoại liên hệ" required><TextInput id="contact-phone" required maxLength={20} type="tel" autoComplete="tel" value={form.contact_phone ?? ''} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} disabled={!canEdit || saving} /></FormField>
        {canEdit && <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button></div>}
      </form>
    </main>
  );
}
