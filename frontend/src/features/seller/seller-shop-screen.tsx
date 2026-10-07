"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { sellerShopApi, type SellerShopProfile, type UpdateSellerShop } from '@/lib/api/seller-shop.api';
import { uploadMediaAsset } from '@/lib/api/media.api';
import { Button } from '@/components/ui/button';
import { FormField, TextArea, TextInput } from '@/components/ui/form-controls';
import { ErrorState, Skeleton } from '@/components/ui/data-states';
import { AdministrativeAddressFields } from '@/components/forms/administrative-address-fields';
import { SellerHeaderNav } from './seller-header-nav';

export function SellerShopScreen() {
  const [shop, setShop] = useState<SellerShopProfile | null>(null);
  const [form, setForm] = useState<UpdateSellerShop>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const profile = await sellerShopApi.get();
      setShop(profile);
      setForm({ shop_name: profile.shop_name, description: profile.description ?? '', pickup_address: profile.pickup_address ?? '', pickup_province: profile.pickup_province ?? '', pickup_province_code: profile.pickup_province_code ?? '', pickup_ward: profile.pickup_ward ?? '', pickup_ward_code: profile.pickup_ward_code ?? '', contact_phone: profile.contact_phone ?? '' });
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

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await uploadMediaAsset(file, { purpose: 'shop_logo' });
      if (!uploaded.mediaId) {
        throw new Error('Không nhận được mã media sau khi tải ảnh.');
      }
      const updated = await sellerShopApi.updateLogo(uploaded.mediaId);
      setShop(updated);
      setNotice('Đã cập nhật logo gian hàng thành công.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải lên logo gian hàng.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await sellerShopApi.update(form);
      setShop(updated);
      setForm({ shop_name: updated.shop_name, description: updated.description ?? '', pickup_address: updated.pickup_address ?? '', pickup_province: updated.pickup_province ?? '', pickup_province_code: updated.pickup_province_code ?? '', pickup_ward: updated.pickup_ward ?? '', pickup_ward_code: updated.pickup_ward_code ?? '', contact_phone: updated.contact_phone ?? '' });
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
          <div><h1 className="text-2xl font-bold text-[var(--foreground)]">Hồ sơ gian hàng</h1><p className="mt-1 text-sm text-[var(--subtext)]">Địa chỉ shop ở đây dùng làm nơi lấy hàng cho các đơn bán; đây không phải sổ địa chỉ giao hàng của người mua.</p></div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm" aria-label={`Trạng thái gian hàng: ${shop.status}`}>{shop.status}</span>
        </div>
      </header>
      <SellerHeaderNav />
      {shop.status === 'PENDING' && <p className="notice notice--warning" role="status">Hãy điền địa chỉ shop và số điện thoại liên hệ để Admin có thể duyệt gian hàng.</p>}
      {!canEdit && <p className="notice" role="status">Hồ sơ đang ở chế độ chỉ xem trong trạng thái hiện tại.</p>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {notice && <p className="notice notice--success" role="status">{notice}</p>}

      {/* Quản lý Logo gian hàng */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Logo gian hàng</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative h-24 w-24 rounded-full border border-[var(--border)] overflow-hidden bg-[var(--muted)] flex items-center justify-center">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt={`Logo ${shop.shop_name}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-[var(--subtext)]">
                {shop.shop_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-sm text-[var(--subtext)]">Chấp nhận JPG, PNG hoặc WebP. Kích thước tối đa 5MB.</p>
            {canEdit && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleLogoChange(e)}
                  disabled={uploadingLogo}
                  aria-label="Tải ảnh logo gian hàng"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Đang tải lên…' : shop.logo_url ? 'Thay đổi logo' : 'Tải lên logo'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <FormField id="shop-name" label="Tên gian hàng" required><TextInput id="shop-name" required minLength={2} maxLength={150} value={form.shop_name ?? ''} onChange={(event) => setForm({ ...form, shop_name: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <FormField id="shop-description" label="Mô tả"><TextArea id="shop-description" rows={4} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <FormField id="pickup-address" label="Địa chỉ shop" required helpText="Dùng làm địa chỉ lấy hàng cho các đơn thuộc gian hàng này."><TextInput id="pickup-address" required maxLength={255} autoComplete="street-address" value={form.pickup_address ?? ''} onChange={(event) => setForm({ ...form, pickup_address: event.target.value })} disabled={!canEdit || saving} /></FormField>
        <AdministrativeAddressFields provinceCode={form.pickup_province_code ?? ''} wardCode={form.pickup_ward_code ?? ''} onProvinceChange={(code, name) => setForm(prev => ({ ...prev, pickup_province_code: code, pickup_province: name, pickup_ward_code: '', pickup_ward: '' }))} onWardChange={(code, name) => setForm(prev => ({ ...prev, pickup_ward_code: code, pickup_ward: name }))} />
        <FormField id="contact-phone" label="Số điện thoại liên hệ" required><TextInput id="contact-phone" required maxLength={20} type="tel" autoComplete="tel" value={form.contact_phone ?? ''} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} disabled={!canEdit || saving} /></FormField>
        {canEdit && <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button></div>}
      </form>
    </main>
  );
}

