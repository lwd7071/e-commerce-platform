"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { buyerApi, type CreateAddressPayload, type WireAddress } from "@/lib/api/buyer.api";

const emptyAddress: CreateAddressPayload = { recipientName: "", phone: "", province: "", district: "", ward: "", detailAddress: "" };

export function AddressManager() {
  const [addresses, setAddresses] = useState<WireAddress[]>([]);
  const [draft, setDraft] = useState<CreateAddressPayload>(emptyAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CreateAddressPayload>(emptyAddress);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAddresses(await buyerApi.getAddresses()); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tải địa chỉ."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    buyerApi.getAddresses().then(value => { if (active) setAddresses(value); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Không thể tải địa chỉ."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await buyerApi.createAddress(draft); setDraft(emptyAddress); setShowCreate(false); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu địa chỉ."); }
    finally { setSaving(false); }
  };

  const update = async (event: FormEvent) => {
    event.preventDefault(); if (!editingId) return; setSaving(true); setError("");
    try { await buyerApi.updateAddress(editingId, editDraft); setEditingId(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật địa chỉ."); }
    finally { setSaving(false); }
  };

  const startEdit = (address: WireAddress) => {
    setEditingId(address.addressId);
    setEditDraft({ recipientName: address.recipientName, phone: address.phone, province: address.province, district: address.district, ward: address.ward, detailAddress: address.detailAddress });
  };

  const fields = (value: CreateAddressPayload, change: (next: CreateAddressPayload) => void) => <div className="grid gap-3 sm:grid-cols-2">
    {([['recipientName', 'Người nhận'], ['phone', 'Số điện thoại'], ['province', 'Tỉnh/thành'], ['district', 'Quận/huyện'], ['ward', 'Phường/xã'], ['detailAddress', 'Địa chỉ chi tiết']] as const).map(([key, label]) => <label key={key} className="field-stack"><span className="field-label">{label}</span><input required value={value[key] ?? ""} onChange={event => change({ ...value, [key]: event.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2.5" /></label>)}
  </div>;

  return <section className="surface-card mt-6 p-5 sm:p-6 space-y-4" aria-labelledby="address-manager-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="address-manager-title" className="section-title">Địa chỉ giao hàng</h2><p className="section-subtitle">Quản lý địa chỉ dùng khi thanh toán.</p></div><button type="button" onClick={() => { setShowCreate(value => !value); setEditingId(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">{showCreate ? "Đóng" : "Thêm địa chỉ"}</button></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[var(--danger-surface)] p-3 text-sm text-[var(--danger-text)]"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Thử lại</button></div>}
    {showCreate && <form onSubmit={create} className="rounded-xl border border-[var(--border)] p-4 space-y-3">{fields(draft, setDraft)}<button disabled={saving} className="rounded-lg bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-fg)]">{saving ? "Đang lưu..." : "Lưu địa chỉ"}</button></form>}
    {loading ? <p role="status" className="text-sm text-[var(--subtext)]">Đang tải địa chỉ...</p> : addresses.length === 0 ? <p className="text-sm text-[var(--subtext)]">Bạn chưa lưu địa chỉ giao hàng nào.</p> : <div className="space-y-3">{addresses.map(address => <article key={address.addressId} className="rounded-xl border border-[var(--border)] p-4">
      {editingId === address.addressId ? <form onSubmit={update} className="space-y-3">{fields(editDraft, setEditDraft)}<div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--button-primary-fg)]">Lưu</button><button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Hủy</button></div></form> : <>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{address.recipientName} · {address.phone} {address.isDefault && <span className="ml-2 rounded-full bg-[var(--primary-surface)] px-2 py-1 text-xs text-[var(--primary-active)]">Mặc định</span>}</p><p className="mt-1 text-sm text-[var(--subtext)]">{address.detailAddress}, {address.ward}, {address.district}, {address.province}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(address)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Sửa</button>{!address.isDefault && <button type="button" onClick={async () => { setSaving(true); try { await buyerApi.setDefaultAddress(address.addressId); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Không thể đổi địa chỉ mặc định."); } finally { setSaving(false); } }} disabled={saving} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">Đặt mặc định</button>}<button type="button" onClick={async () => { if (!window.confirm("Xóa địa chỉ này?")) return; setSaving(true); try { await buyerApi.deleteAddress(address.addressId); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Không thể xóa địa chỉ."); } finally { setSaving(false); } }} disabled={saving} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--danger-text)]">Xóa</button></div></div>
      </>}
    </article>)}</div>}
  </section>;
}
