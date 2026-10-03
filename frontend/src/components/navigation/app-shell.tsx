"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MobileDock, SiteHeader } from "./site-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = user?.role ?? null;
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  return (
    <>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      {!isAuthRoute && <SiteHeader role={role} />}
      <main className={`site-main${isAuthRoute ? " site-main--auth" : ""}`} id="main-content" tabIndex={-1}>{children}</main>
      {!isAuthRoute && <MobileDock role={role} />}
    </>
  );
}
