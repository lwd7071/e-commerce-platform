"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await requestPasswordReset(email); } catch { /* keep the response neutral to avoid disclosing account existence */ } finally { setSent(true); setBusy(false); } };
  return <main className="min-h-screen grid place-items-center p-4"><section className="w-full max-w-md surface-card p-7 space-y-4"><h1 className="text-2xl font-bold">Quên mật khẩu</h1><p className="text-sm text-[var(--subtext)]">Nhập email và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu nếu tài khoản phù hợp.</p>
    <form onSubmit={submit} className="space-y-4"><label className="field-stack"><span className="field-label">Email</span><input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3" /></label>
      <button disabled={busy} className="w-full rounded-xl bg-[var(--button-primary-bg)] p-3 font-semibold text-[var(--button-primary-fg)]">{busy ? "Đang gửi..." : "Gửi hướng dẫn"}</button></form>
    {sent && <p role="status" className="text-sm">Nếu email tồn tại, thư hướng dẫn sẽ được gửi.</p>}<Link href="/login" className="text-sm text-[var(--primary-active)]">Quay lại đăng nhập</Link>
  </section></main>;
}
