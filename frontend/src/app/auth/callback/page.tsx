"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { useAuth } from "@/lib/auth/auth-context";
import { setAuthTokenProvider } from "@/lib/api/client";
import { apiClient } from "@/lib/api/client";
import { sanitizeReturnTo } from "@/lib/auth/route-guards";
import type { UserRole } from "@/lib/auth/types";

function CallbackHandler() {
  const router = useRouter();
  const search = useSearchParams();
  const { completeOnboarding } = useAuth();
  const [message, setMessage] = useState("Đang xác minh phiên đăng nhập...");

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase Auth chưa được cấu hình.");
      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
      setAuthTokenProvider(() => session.access_token);
      const flow = search.get("flow");
      if (flow === "recovery") { router.replace("/reset-password"); return; }

      const identity = await apiClient.get<{ profile_completed: boolean }>("/auth/me");
      const returnTo = sanitizeReturnTo(sessionStorage.getItem("dino_auth_return_to"));
      if (!identity.profile_completed) {
        let draft: { full_name?: string; requested_role?: UserRole; shop_name?: string | null } = {};
        try { draft = JSON.parse(sessionStorage.getItem("dino_signup_draft") || "{}"); } catch { /* use completion form */ }
        if (!draft.full_name || !draft.requested_role || (draft.requested_role === "SELLER" && !draft.shop_name)) {
          router.replace("/complete-profile"); return;
        }
        await completeOnboarding(draft.full_name, draft.requested_role, draft.shop_name ?? undefined);
        sessionStorage.removeItem("dino_signup_draft");
      }
      sessionStorage.removeItem("dino_auth_return_to");
      router.replace(returnTo);
    })().catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập."); });
    return () => { active = false; };
  }, [completeOnboarding, router, search]);

  return <main className="min-h-screen grid place-items-center p-6"><p role="status" className="text-sm text-[var(--subtext)]">{message}</p></main>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<main className="min-h-screen grid place-items-center">Đang tải...</main>}><CallbackHandler /></Suspense>;
}
