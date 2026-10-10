"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  const [hasError, setHasError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase Auth chưa được cấu hình.");

      const { data, error } = await supabase.auth.getSession();
      let session = data.session;
      if (error) throw error;

      // Tránh race condition khi Supabase client đang parse token từ URL hash/query
      if (!session) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const retryResult = await supabase.auth.getSession();
        session = retryResult.data.session;
        if (retryResult.error) throw retryResult.error;
      }

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
    })().catch(error => {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập.");
    });
  }, [completeOnboarding, router, search]);

  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <p role="status" className={`text-sm ${hasError ? "text-red-500 font-medium" : "text-[var(--subtext)]"}`}>
          {message}
        </p>
        {hasError && (
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            Quay lại trang Đăng nhập
          </Link>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center">Đang tải...</main>}>
      <CallbackHandler />
    </Suspense>
  );
}
