import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { buyerApi, type CreateAddressPayload, type WireAddress } from "@/lib/api/buyer.api";
import { AdministrativeAddressFields } from "@/components/forms/administrative-address-fields";
import { useAuth } from "@/lib/auth/auth-context";

import { QueryProvider } from "@/lib/query/query-provider";

const emptyAddress: CreateAddressPayload = { recipientName: "", phone: "", province: "", district: "", ward: "", detailAddress: "" };

export function AddressManager() {
  return (
    <QueryProvider>
      <InnerAddressManager />
    </QueryProvider>
  );
}

function InnerAddressManager() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = getQueryClient();
  const { data: addresses = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: queryKeys.profile.addresses(userId),
    queryFn: () => buyerApi.getAddresses(),
    enabled: Boolean(userId),
  });

  const [draft, setDraft] = useState<CreateAddressPayload>(emptyAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CreateAddressPayload>(emptyAddress);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!draft.province_code || !draft.ward_code) { setError("Vui lòng chọn tỉnh/thành phố và phường/xã từ danh sách gợi ý."); return; }
    setSaving(true);
    try {
      await buyerApi.createAddress(draft);
      setDraft(emptyAddress);
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses(userId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu địa chỉ.");
    } finally {
      setSaving(false);
    }
  };

  const update = async (event: FormEvent) => {
    event.preventDefault(); if (!editingId) return; setError("");
    if (!editDraft.province_code || !editDraft.ward_code) { setError("Vui lòng chọn tỉnh/thành phố và phường/xã từ danh sách gợi ý."); return; }
    setSaving(true);
    try {
      await buyerApi.updateAddress(editingId, editDraft);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses(userId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật địa chỉ.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (address: WireAddress) => {
    setEditingId(address.addressId);
    setEditDraft({ recipientName: address.recipientName, phone: address.phone, province: address.province, province_code: address.provinceCode ?? undefined, ward_code: address.wardCode ?? undefined, ward: address.ward, district: address.district ?? undefined, detailAddress: address.detailAddress });
  };

  const fields = (value: CreateAddressPayload, change: React.Dispatch<React.SetStateAction<CreateAddressPayload>>) => <div className="grid gap-3 sm:grid-cols-2">
    {([['recipientName', 'Người nhận'], ['phone', 'Số điện thoại'], ['detailAddress', 'Địa chỉ chi tiết']] as const).map(([key, label]) => <label key={key} className="field-stack"><span className="field-label">{label}</span><input required value={value[key] ?? ""} onChange={event => change(prev => ({ ...prev, [key]: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2.5" /></label>)}
    <div className="sm:col-span-2"><AdministrativeAddressFields provinceCode={value.province_code ?? ''} provinceName={value.province ?? ''} wardCode={value.ward_code ?? ''} wardName={value.ward ?? ''} locality={value.district ?? ''} onLocalityChange={district => change(prev => ({ ...prev, district }))} onProvinceChange={(code, name) => change(prev => ({ ...prev, province_code: code, province: name, ward_code: '', ward: '', district: '' }))} onWardChange={(code, name) => change(prev => ({ ...prev, ward_code: code, ward: name, district: '' }))} /></div>
  </div>;

  return <section className="surface-card mt-6 p-5 sm:p-6 space-y-4" aria-labelledby="address-manager-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="address-manager-title" className="section-title">Địa chỉ giao hàng</h2><p className="section-subtitle">Quản lý địa chỉ dùng khi thanh toán.</p></div><button type="button" onClick={() => { setShowCreate(value => !value); setEditingId(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">{showCreate ? "Đóng" : "Thêm địa chỉ"}</button></div>
    {(error || queryError) && (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[var(--danger-surface)] p-3 text-sm text-[var(--danger-text)]">
        <span>{error || (queryError instanceof Error ? queryError.message : "Không thể tải địa chỉ.")}</span>
        <button type="button" onClick={() => void refetch()} className="font-semibold underline">Thử lại</button>
      </div>
    )}
    {showCreate && <form onSubmit={create} className="rounded-xl border border-[var(--border)] p-4 space-y-3">{fields(draft, setDraft)}<button disabled={saving} className="rounded-lg bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-fg)]">{saving ? "Đang lưu..." : "Lưu địa chỉ"}</button></form>}
    {loading && addresses.length === 0 ? (
      <div role="status" className="min-h-[220px] space-y-3 animate-pulse" aria-label="Đang tải địa chỉ" aria-busy="true">
        <div className="h-20 w-full rounded-xl bg-[var(--card-muted)]" />
        <div className="h-20 w-full rounded-xl bg-[var(--card-muted)]" />
      </div>
    ) : addresses.length === 0 ? (
      <p className="text-sm text-[var(--subtext)]">Bạn chưa lưu địa chỉ giao hàng nào.</p>
    ) : (
      <div className="min-h-[220px] space-y-3" aria-busy={loading}>
        {addresses.map(address => <article key={address.addressId} className="rounded-xl border border-[var(--border)] p-4">
          {editingId === address.addressId ? <form onSubmit={update} className="space-y-3">{fields(editDraft, setEditDraft)}<div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-fg)]">Lưu</button><button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Hủy</button></div></form> : <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{address.recipientName} · {address.phone} {address.isDefault && <span className="ml-2 rounded-full bg-[var(--primary-surface)] px-2 py-1 text-xs text-[var(--primary-active)]">Mặc định</span>}</p><p className="mt-1 text-sm text-[var(--subtext)]">{[address.detailAddress, address.district, address.ward, address.province].filter(Boolean).join(', ')}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(address)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Sửa</button>{!address.isDefault && <button type="button" onClick={async () => { setSaving(true); try { await buyerApi.setDefaultAddress(address.addressId); await queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses(userId) }); } catch (err) { setError(err instanceof Error ? err.message : "Không thể đổi địa chỉ mặc định."); } finally { setSaving(false); } }} disabled={saving} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Đặt mặc định</button>}<button type="button" onClick={async () => { if (!window.confirm("Xóa địa chỉ này?")) return; setSaving(true); try { await buyerApi.deleteAddress(address.addressId); await queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses(userId) }); } catch (err) { setError(err instanceof Error ? err.message : "Không thể xóa địa chỉ."); } finally { setSaving(false); } }} disabled={saving} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--danger-text)]">Xóa</button></div></div>
          </>}
        </article>)}
      </div>
    )}
  </section>;
}
