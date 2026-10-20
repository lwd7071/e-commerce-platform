"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MobileDock, SiteHeader } from "./site-navigation";
import { SellerSidebar } from "./seller-sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { RoleMobileMenu } from "./role-mobile-menu";
import { BuyerChatController } from "@/components/chat/buyer-chat-controller";
import { useCallback, useState } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = user?.role ?? null;
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isSellerRoute = pathname === "/seller" || pathname.startsWith("/seller/") || (role === "SELLER" && pathname === "/notifications");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthFlowRoute = isAuthRoute || pathname.startsWith("/auth/") || ["/verify-email", "/forgot-password", "/reset-password", "/complete-profile"].includes(pathname);
  const buyerChatEnabled = Boolean(user?.role === "BUYER" && !isAuthFlowRoute && !isSellerRoute && !isAdminRoute);

  return (
    <BuyerChatController key={`${user?.id ?? "anonymous"}:${buyerChatEnabled}`} enabled={buyerChatEnabled}>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      {!isAuthRoute && <SiteHeader role={role} isSellerArea={isSellerRoute} isAdminArea={isAdminRoute} onMobileMenuOpen={() => setMobileMenuOpen(true)} />}
      {isSellerRoute && role === "SELLER" && <RoleMobileMenu role="SELLER" open={mobileMenuOpen} onClose={closeMobileMenu} />}
      {isAdminRoute && role === "ADMIN" && <RoleMobileMenu role="ADMIN" open={mobileMenuOpen} onClose={closeMobileMenu} />}
      {isSellerRoute || (isAdminRoute && role === "ADMIN") ? (
        <div className="seller-layout flex min-h-[calc(100vh-var(--header-height,76px))] min-w-0">
          {isSellerRoute ? <SellerSidebar /> : <AdminSidebar />}
          <main className="seller-main min-w-0 flex-1 bg-[var(--background)] p-4 md:overflow-y-auto md:p-8" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      ) : (
        <main className={`site-main${isAuthRoute ? " site-main--auth" : ""}${pathname === "/" ? " site-main--home" : ""}`} id="main-content" tabIndex={-1}>
          {children}
        </main>
      )}
      {!isAuthRoute && !isSellerRoute && !isAdminRoute && <MobileDock role={role} />}
    </BuyerChatController>
  );
}

