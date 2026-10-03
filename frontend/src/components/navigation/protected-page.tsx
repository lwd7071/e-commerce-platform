"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { UserRole } from "@/lib/auth/types";
import { Icon } from "../ui/icon";

export function ProtectedPage({ children, allowedRoles }: { children: ReactNode; allowedRoles?: UserRole[] }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [isLoading, pathname, router, user]);

  if (isLoading) return <section className="surface-card loading-stack" aria-busy="true" aria-label="Đang kiểm tra phiên đăng nhập"><Icon name="spinner" />Đang tải tài khoản…</section>;
  if (!user) return <section className="notice" role="status"><Icon name="info" />Đang chuyển đến trang đăng nhập…</section>;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <section className="error-state surface-card" role="status" aria-labelledby="forbidden-title">
        <span className="empty-state__icon"><Icon name="warning" /></span>
        <h1 id="forbidden-title">Bạn không có quyền xem trang này</h1>
        <p>Tài khoản hiện tại không được phép truy cập nội dung này.</p>
        <Link className="button button--secondary" href={user.role === "ADMIN" ? "/admin" : user.role === "SELLER" ? "/seller" : "/"}>
          Quay lại khu vực của bạn
        </Link>
      </section>
    );
  }
  return children;
}
