"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { UserRole } from "@/lib/auth/types";

export default function CompleteProfilePage() {
  const router = useRouter(); const { user, completeOnboarding } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? ""); const [role, setRole] = useState<UserRole>("BUYER"); const [shopName, setShopName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (fullName.trim().length < 2 || (role === "SELLER" && shopName.trim().length < 2)) { setError("Vui lòng nhập thông tin hợp lệ."); return; } setBusy(true); try { await completeOnboarding(fullName, role, shopName); router.replace("/"); } catch (err) { setError(err instanceof Error ? err.message : "Không thể hoàn tất hồ sơ."); } finally { setBusy(false); } };
  return <main className="min-h-screen grid place-items-center p-4"><section className="w-full max-w-md surface-card p-7 space-y-4"><h1 className="text-2xl font-bold">Hoàn tất hồ sơ</h1><p className="text-sm text-[var(--subtext)]">Chúng tôi cần thêm thông tin trước khi tiếp tục.</p><form onSubmit={submit} className="space-y-4"><label className="field-stack"><span className="field-label">Họ và tên</span><input required minLength={2} maxLength={150} value={fullName} onChange={event => setFullName(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3" /></label><label className="field-stack"><span className="field-label">Vai trò</span><select value={role} onChange={event => setRole(event.target.value as UserRole)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"><option value="BUYER">Người mua</option><option value="SELLER">Người bán</option></select></label>{role === "SELLER" && <label className="field-stack"><span className="field-label">Tên gian hàng</span><input required minLength={2} maxLength={150} value={shopName} onChange={event => setShopName(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3" /></label>}{error && <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>}<button disabled={busy || !user} className="w-full rounded-xl bg-[var(--button-primary-bg)] p-3 font-semibold text-[var(--button-primary-fg)]">{busy ? "Đang lưu..." : "Hoàn tất"}</button></form></section></main>;
}
