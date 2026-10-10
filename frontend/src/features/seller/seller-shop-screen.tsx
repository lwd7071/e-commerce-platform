"use client";

import { useEffect, useState, useRef } from 'react';
import { sellerShopApi, type SellerShopProfile, type UpdateSellerShop, type ShopMallRequest } from '@/lib/api/seller-shop.api';
import { uploadMediaAsset } from '@/lib/api/media.api';
import { Button } from '@/components/ui/button';
import { FormField, TextArea, TextInput } from '@/components/ui/form-controls';
import { ErrorState, Skeleton } from '@/components/ui/data-states';
import { AdministrativeAddressFields } from '@/components/forms/administrative-address-fields';
import { SellerHeaderNav } from './seller-header-nav';

export function SellerShopScreen() {
  const [shop, setShop] = useState<SellerShopProfile | null>(null);
  const [mallRequests, setMallRequests] = useState<ShopMallRequest[]>([]);
  const [form, setForm] = useState<UpdateSellerShop>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mall Request Form State
  const [mallDocUrl, setMallDocUrl] = useState('');
  const [mallReason, setMallReason] = useState('');
  const [submittingMall, setSubmittingMall] = useState(false);
  const [cancellingMall, setCancellingMall] = useState(false);
  const [mallError, setMallError] = useState<string | null>(null);
  const [mallNotice, setMallNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profile, requests] = await Promise.all([
        sellerShopApi.get(),
        typeof sellerShopApi.getMallRequests === 'function'
          ? sellerShopApi.getMallRequests().catch(() => [] as ShopMallRequest[])
          : Promise.resolve([] as ShopMallRequest[]),
      ]);
      setShop(profile);
      setMallRequests(requests);
      setForm({
        shop_name: profile.shop_name,
        description: profile.description ?? '',
        pickup_address: profile.pickup_address ?? '',
        pickup_province: profile.pickup_province ?? '',
        pickup_province_code: profile.pickup_province_code ?? '',
        pickup_ward: profile.pickup_ward ?? '',
        pickup_ward_code: profile.pickup_ward_code ?? '',
        contact_phone: profile.contact_phone ?? '',
      });
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
    if (!form.pickup_province_code || !form.pickup_ward_code) {
      setError('Vui lòng chọn tỉnh/thành phố và phường/xã từ danh sách gợi ý.');
      return;
    }
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

  async function handleSubmitMall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingMall(true);
    setMallError(null);
    setMallNotice(null);
    try {
      if (!mallDocUrl.trim() || !/^https?:\/\/.+/i.test(mallDocUrl.trim())) {
        throw new Error('Đường dẫn hồ sơ chứng minh thương hiệu (document_url) không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      }
      if (!mallReason.trim() || mallReason.trim().length < 10) {
        throw new Error('Lý do nâng hạng phải có ít nhất 10 ký tự.');
      }
      const created = await sellerShopApi.submitMallRequest({
        document_url: mallDocUrl.trim(),
        reason: mallReason.trim(),
      });
      setMallRequests(prev => [created, ...prev]);
      setMallDocUrl('');
      setMallReason('');
      setMallNotice('Đã gửi yêu cầu nâng hạng Dino Mall thành công! Vui lòng chờ Admin xét duyệt.');
    } catch (cause) {
      setMallError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu nâng hạng.');
    } finally {
      setSubmittingMall(false);
    }
  }

  async function handleCancelMall(requestId: string) {
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu nâng hạng Dino Mall này?')) return;
    setCancellingMall(true);
    setMallError(null);
    setMallNotice(null);
    try {
      const cancelled = await sellerShopApi.cancelMallRequest(requestId);
      setMallRequests(prev => prev.map(r => ((r.request_id || r.id) === (cancelled?.request_id || cancelled?.id || requestId)) ? { ...r, ...cancelled, status: 'CANCELLED' } : r));
      setMallNotice('Đã hủy yêu cầu nâng hạng Dino Mall.');
    } catch (cause) {
      setMallError(cause instanceof Error ? cause.message : 'Không thể hủy yêu cầu nâng hạng.');
    } finally {
      setCancellingMall(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl space-y-4 px-4 py-8"><Skeleton height={52} /><Skeleton height={280} /></main>;
  if (error && !shop) return <main className="mx-auto max-w-3xl px-4 py-8"><ErrorState title="Không tải được hồ sơ gian hàng" description={error} onRetry={() => void load()} /></main>;
  if (!shop) return null;

  const canEdit = shop.status === 'PENDING' || shop.status === 'ACTIVE';
  const pendingMallRequest = mallRequests.find(r => r.status === 'PENDING');
  const latestRejectedRequest = mallRequests.find(r => r.status === 'REJECTED');

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Hồ sơ gian hàng</h1>
            <p className="mt-1 text-sm text-[var(--subtext)]">Địa chỉ shop ở đây dùng làm nơi lấy hàng cho các đơn bán; đây không phải sổ địa chỉ giao hàng của người mua.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void load()}
              disabled={loading}
              className="text-xs px-2.5 py-1"
              aria-label="Làm mới trạng thái gian hàng"
            >
              ↻ Làm mới
            </Button>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-medium" aria-label={`Trạng thái gian hàng: ${shop.status}`}>{shop.status}</span>
            {shop.tier === 'MALL' ? (
              <span className="rounded-full bg-rose-600 text-white font-bold text-xs px-3 py-1 shadow-sm flex items-center gap-1">
                ★ DINO MALL
              </span>
            ) : shop.tier === 'PREFERRED' ? (
              <span className="rounded-full bg-amber-500/15 text-amber-600 font-bold text-xs px-3 py-1 border border-amber-500/30">
                Shop Yêu Thích
              </span>
            ) : (
              <span className="rounded-full bg-[var(--muted)] text-[var(--subtext)] text-xs px-3 py-1 border border-[var(--border)]">
                Tiêu chuẩn
              </span>
            )}
          </div>
        </div>
      </header>
      <SellerHeaderNav />
      {shop.status === 'PENDING' && <p className="notice notice--warning" role="status">Hãy điền địa chỉ shop và số điện thoại liên hệ để Admin có thể duyệt gian hàng.</p>}
      {!canEdit && <p className="notice" role="status">Hồ sơ đang ở chế độ chỉ xem trong trạng thái hiện tại.</p>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {notice && <p className="notice notice--success" role="status">{notice}</p>}

      {/* Quản lý Dino Mall */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Cấp bậc gian hàng & Dino Mall</h2>
              <p className="text-xs text-[var(--subtext)]">Tham gia Dino Mall để nhận huy hiệu chính hãng, ưu tiên hiển thị và tăng độ tin cậy từ người mua.</p>
            </div>
          </div>
          {shop.tier === 'MALL' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
              ✓ Đã là Dino Mall
            </span>
          ) : pendingMallRequest ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              ⏳ Đang chờ duyệt
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--muted)] text-[var(--subtext)] border border-[var(--border)]">
              Chưa đăng ký Mall
            </span>
          )}
        </div>

        {mallError && <div className="notice notice--error" role="alert">{mallError}</div>}
        {mallNotice && <p className="notice notice--success" role="status">{mallNotice}</p>}

        {shop.tier === 'MALL' ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-4">
            <span className="text-3xl">🛡️</span>
            <div>
              <div className="font-semibold text-rose-600 dark:text-rose-400">Gian hàng Dino Mall Chính Hãng</div>
              <p className="text-xs text-[var(--subtext)] mt-1">Shop của bạn đã đạt chuẩn Dino Mall chính hãng. Mọi sản phẩm đều hiển thị huy hiệu Dino Mall trên sàn thương mại.</p>
            </div>
          </div>
        ) : pendingMallRequest ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">Yêu cầu nâng hạng đang được xử lý</div>
                <p className="text-xs text-[var(--subtext)] mt-0.5">Ngày gửi: {new Date(pendingMallRequest.created_at).toLocaleString('vi-VN')}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCancelMall(pendingMallRequest.request_id || pendingMallRequest.id!)}
                disabled={cancellingMall}
                className="text-xs text-rose-600 hover:text-rose-700 border-rose-200"
              >
                {cancellingMall ? 'Đang hủy…' : 'Hủy yêu cầu'}
              </Button>
            </div>
            <div className="text-xs space-y-1 text-[var(--subtext)] bg-[var(--card)] p-3 rounded border border-[var(--border)]">
              <div><strong>Hồ sơ xác thực:</strong> <a href={pendingMallRequest.document_url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline break-all">{pendingMallRequest.document_url}</a></div>
              <div><strong>Lý do đăng ký:</strong> {pendingMallRequest.reason}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {latestRejectedRequest && latestRejectedRequest.admin_note && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400">
                <strong>Yêu cầu gần nhất đã bị từ chối:</strong> {latestRejectedRequest.admin_note}
                <div className="mt-1 text-[var(--subtext)]">Bạn có thể chuẩn bị lại tài liệu hợp lệ và gửi lại yêu cầu mới bên dưới.</div>
              </div>
            )}
            <form onSubmit={(e) => void handleSubmitMall(e)} className="space-y-3 pt-2">
              <FormField id="mall-doc-url" label="Link hồ sơ chứng minh thương hiệu (PDF/Drive/Dropbox)" required helpText="Cung cấp link tài liệu chứa giấy phép ĐKKD, giấy ủy quyền phân phối hoặc bảo hộ thương hiệu.">
                <TextInput
                  id="mall-doc-url"
                  type="url"
                  required
                  placeholder="https://drive.google.com/..."
                  value={mallDocUrl}
                  onChange={(e) => setMallDocUrl(e.target.value)}
                  disabled={submittingMall}
                />
              </FormField>
              <FormField id="mall-reason" label="Lý do & Giới thiệu năng lực thương hiệu" required helpText="Mô tả tóm tắt giấy phép ủy quyền, cam kết hàng chính hãng (tối thiểu 10 ký tự).">
                <TextInput
                  id="mall-reason"
                  required
                  placeholder="Ví dụ: Đại lý phân phối chính hãng ủy quyền chính thức từ thương hiệu..."
                  value={mallReason}
                  onChange={(e) => setMallReason(e.target.value)}
                  disabled={submittingMall}
                />
              </FormField>
              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={submittingMall}>
                  {submittingMall ? 'Đang gửi hồ sơ…' : 'Gửi yêu cầu nâng hạng Dino Mall'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

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
        <AdministrativeAddressFields provinceCode={form.pickup_province_code ?? ''} provinceName={form.pickup_province ?? ''} wardCode={form.pickup_ward_code ?? ''} wardName={form.pickup_ward ?? ''} onProvinceChange={(code, name) => setForm(prev => ({ ...prev, pickup_province_code: code, pickup_province: name, pickup_ward_code: '', pickup_ward: '' }))} onWardChange={(code, name) => setForm(prev => ({ ...prev, pickup_ward_code: code, pickup_ward: name }))} />
        <FormField id="contact-phone" label="Số điện thoại liên hệ" required><TextInput id="contact-phone" required maxLength={20} type="tel" autoComplete="tel" value={form.contact_phone ?? ''} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} disabled={!canEdit || saving} /></FormField>
        {canEdit && <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button></div>}
      </form>
    </main>
  );
}


