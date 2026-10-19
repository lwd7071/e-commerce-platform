"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { MobileDock, SiteHeader } from "./site-navigation";
import { SellerSidebar } from "./seller-sidebar";
import { BuyerChatController } from "@/components/chat/buyer-chat-controller";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sellerMenuOpen, setSellerMenuOpen] = useState(false);

  useEffect(() => {
    setSellerMenuOpen(false);
  }, [pathname]);

  const role = user?.role ?? null;
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isSellerRoute = pathname === "/seller" || pathname.startsWith("/seller/") || (role === "SELLER" && pathname === "/notifications");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthFlowRoute = isAuthRoute || pathname.startsWith("/auth/") || ["/verify-email", "/forgot-password", "/reset-password", "/complete-profile"].includes(pathname);
  const buyerChatEnabled = Boolean(user?.role === "BUYER" && !isAuthFlowRoute && !isSellerRoute && !isAdminRoute);

  return (
    <BuyerChatController key={`${user?.id ?? "anonymous"}:${buyerChatEnabled}`} enabled={buyerChatEnabled}>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      {!isAuthRoute && (
        <SiteHeader
          role={role}
          isSellerArea={isSellerRoute}
          onToggleSellerMenu={() => setSellerMenuOpen((prev) => !prev)}
        />
      )}
      {isSellerRoute ? (
        <div className="seller-layout flex min-h-[calc(100vh-var(--header-height,76px))]">
          <SellerSidebar
            mobileOpen={sellerMenuOpen}
            onCloseMobile={() => setSellerMenuOpen(false)}
          />
          <main className="seller-main flex-1 min-w-0 p-4 sm:p-6 md:p-8 bg-[var(--background)] overflow-y-auto" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      ) : (
        <main className={`site-main${isAuthRoute ? " site-main--auth" : ""}${pathname === "/" ? " site-main--home" : ""}`} id="main-content" tabIndex={-1}>
          {children}
        </main>
      )}
      {!isAuthRoute && !isSellerRoute && <MobileDock role={role} />}
    </BuyerChatController>
  );
}

