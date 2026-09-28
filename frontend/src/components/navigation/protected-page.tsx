"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon } from "../ui/icon";

export function ProtectedPage({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [isLoading, pathname, router, user]);

  if (isLoading) return <section className="surface-card loading-stack" aria-busy="true" aria-label="Đang kiểm tra phiên đăng nhập"><Icon name="spinner" />Đang tải tài khoản…</section>;
  if (!user) return <section className="notice" role="status"><Icon name="info" />Đang chuyển đến trang đăng nhập…</section>;
  return children;
}
