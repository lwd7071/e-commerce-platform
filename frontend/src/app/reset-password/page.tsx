"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

export default function ResetPasswordPage() {
  const router = useRouter(); const { updatePassword } = useAuth();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); return; } if (password !== confirm) { setError("Mật khẩu xác nhận chưa khớp."); return; } setBusy(true); try { await updatePassword(password); router.replace("/login?passwordReset=1"); } catch (err) { setError(err instanceof Error ? err.message : "Không thể đặt lại mật khẩu."); } finally { setBusy(false); } };
  return <main className="min-h-screen grid place-items-center p-4"><section className="w-full max-w-md surface-card p-7 space-y-4"><h1 className="text-2xl font-bold">Đặt mật khẩu mới</h1><form onSubmit={submit} className="space-y-4"><label className="field-stack"><span className="field-label">Mật khẩu mới</span><input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3" /></label><label className="field-stack"><span className="field-label">Xác nhận mật khẩu</span><input type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3" /></label>{error && <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[var(--button-primary-bg)] p-3 font-semibold text-[var(--button-primary-fg)]">{busy ? "Đang lưu..." : "Cập nhật mật khẩu"}</button></form></section></main>;
}
