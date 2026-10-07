"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MobileDock, SiteHeader } from "./site-navigation";
import { SellerSidebar } from "./seller-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = user?.role ?? null;
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isSellerRoute = pathname === "/seller" || pathname.startsWith("/seller/");

  return (
    <>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      {!isAuthRoute && <SiteHeader role={role} isSellerArea={isSellerRoute} />}
      {isSellerRoute ? (
        <div className="seller-layout flex min-h-[calc(100vh-var(--header-height,76px))]">
          <SellerSidebar />
          <main className="seller-main flex-1 p-6 md:p-8 bg-[var(--background)] overflow-y-auto" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      ) : (
        <main className={`site-main${isAuthRoute ? " site-main--auth" : ""}`} id="main-content" tabIndex={-1}>
          {children}
        </main>
      )}
      {!isAuthRoute && !isSellerRoute && <MobileDock role={role} />}
    </>
  );
}

