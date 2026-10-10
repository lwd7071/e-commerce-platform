"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth/auth-context";

function VerifyForm() {
  const router = useRouter();
  const search = useSearchParams();
  const email = search.get("email") ?? "";
  const { verifySignupOtp, resendSignupOtp } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);

  useEffect(() => {
    if (resendSeconds === 0) return;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await verifySignupOtp(email, code);
      const draft = sessionStorage.getItem("dino_signup_draft");
      if (draft) sessionStorage.removeItem("dino_signup_draft");
      router.replace(draft ? "/" : "/complete-profile");
    } catch (err) { setError(err instanceof Error ? err.message : "Mã xác minh không hợp lệ."); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError(""); setNotice("");
    try { await resendSignupOtp(email); setNotice("Đã gửi lại mã xác minh."); setResendSeconds(60); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể gửi lại mã."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen grid place-items-center p-4"><section className="w-full max-w-md surface-card p-7 space-y-4">
    <h1 className="text-2xl font-bold">Xác minh email</h1><p className="text-sm text-[var(--subtext)]">Nhập mã 6 số đã gửi đến {email || "email của bạn"}.</p>
    <form onSubmit={submit} className="space-y-4"><label className="field-stack"><span className="field-label">Mã xác minh</span><input aria-label="Mã xác minh" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-center text-xl tracking-[0.4em]" /></label>
      {error && <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>}{notice && <p role="status" className="text-sm text-[var(--success-text)]">{notice}</p>}
      <button disabled={busy || code.length !== 6} className="w-full rounded-xl bg-[var(--button-primary-bg)] p-3 font-semibold text-[var(--button-primary-fg)]">{busy ? "Đang xác minh..." : "Xác minh"}</button>
    </form><button type="button" disabled={busy || !email || resendSeconds > 0} onClick={resend} className="text-sm font-semibold text-[var(--primary-active)]">{resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds} giây` : "Gửi lại mã"}</button>
  </section></main>;
}

export default function VerifyEmailPage() { return <Suspense fallback={<main className="min-h-screen grid place-items-center">Đang tải...</main>}><VerifyForm /></Suspense>; }
