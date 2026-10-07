"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem } from "@/lib/api/catalog.api";
import type { WireVoucher } from "@/lib/api/voucher.api";
import { repositories } from "@/lib/repositories/repository-factory";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";
import { ProductCard } from "./product-card";

function formatDiscount(voucher: WireVoucher) {
  if (voucher.discountType === "PERCENT") {
    const value = `${Number(voucher.discountValue)}%`;
    return voucher.maxDiscount
      ? `Giảm ${value}, tối đa ${moneyAdapter.formatVND(voucher.maxDiscount)}`
      : `Giảm ${value}`;
  }
  return `Giảm ${moneyAdapter.formatVND(voucher.discountValue)}`;
}

export function HomeMarketplaceContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [products, setProducts] = useState<WireCatalogProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [vouchers, setVouchers] = useState<WireVoucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);
  const [vouchersError, setVouchersError] = useState(false);
  const isSeller = user?.role === "SELLER";
  const canViewVouchers = user?.role === "BUYER";

  const loadProducts = useCallback(async () => {
    try {
      const result = await repositories.catalog().getProductsPaginated({
        limit: 20,
        sort: "created_at_desc",
      });
      setProducts(
        result.data
          .filter((product) => product.total_stock > 0 && product.status !== "INACTIVE" && product.status !== "HIDDEN")
          .slice(0, 4),
      );
    } catch {
      setProductsError(true);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadVouchers = useCallback(async () => {
    try {
      const now = Date.now();
      const result = await repositories.voucher().getVouchers();
      setVouchers(
        result
          .filter((voucher) =>
            voucher.status === "ACTIVE" &&
            voucher.quantity > 0 &&
            Date.parse(voucher.startAt) <= now &&
            Date.parse(voucher.endAt) > now,
          )
          .slice(0, 3),
      );
    } catch {
      setVouchersError(true);
    } finally {
      setVouchersLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    if (!isAuthLoading && canViewVouchers) void Promise.resolve().then(loadVouchers);
  }, [isAuthLoading, canViewVouchers, loadVouchers]);

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-[var(--primary-border)] bg-gradient-to-b from-[var(--primary-surface)] to-[var(--card)] p-8 text-center md:p-14">
        <div className="mx-auto max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-border)] bg-[var(--card)] px-3.5 py-1 text-xs font-bold text-[var(--primary-active)] shadow-xs">
            ✨ Mua sắm thông minh cùng Dino
          </span>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl md:text-5xl">
            Khám phá hàng ngàn sản phẩm chất lượng cao
          </h1>
          <p className="mx-auto max-w-xl text-sm text-[var(--subtext)] md:text-base">
            Hàng chính hãng từ các nhà bán uy tín, thanh toán an toàn và giao vận nhanh chóng toàn quốc.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/products" className="button button--primary h-11 px-6 text-sm font-bold shadow-md">
              Xem tất cả sản phẩm
            </Link>
            {isSeller ? (
              <Link href="/seller/products" className="button button--secondary h-11 px-6 text-sm font-semibold">
                Kênh Người Bán
              </Link>
            ) : (
              <a href="#uu-dai" className="button button--secondary h-11 px-6 text-sm font-semibold">
                Khám phá ưu đãi
              </a>
            )}
          </div>
        </div>
      </section>

      <section id="uu-dai" className="scroll-mt-24 space-y-4" aria-labelledby="home-vouchers-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Ưu đãi Dino</p>
            <h2 id="home-vouchers-title" className="text-2xl font-bold text-[var(--foreground)]">Ưu đãi đang áp dụng</h2>
          </div>
          {canViewVouchers && <p className="text-sm text-[var(--subtext)]">Nhập mã khi thanh toán</p>}
        </div>

        {isAuthLoading || (canViewVouchers && vouchersLoading) ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đang tải ưu đãi">
            {[0, 1, 2].map((item) => <Skeleton key={item} height={132} className="rounded-xl" />)}
          </div>
        ) : canViewVouchers ? (
          vouchersError ? (
            <ErrorState title="Chưa tải được ưu đãi" description="Vui lòng thử tải lại danh sách voucher." onRetry={() => { setVouchersLoading(true); setVouchersError(false); void loadVouchers(); }} />
          ) : vouchers.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vouchers.map((voucher) => (
                <article key={voucher.voucherId} className="surface-card flex flex-col justify-between gap-4 border-dashed border-[var(--primary-border)] p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary-active)]">
                      {voucher.scope === "PLATFORM" ? "Ưu đãi toàn sàn" : "Ưu đãi gian hàng"}
                    </p>
                    <h3 className="mt-1 font-semibold text-[var(--foreground)]">{voucher.voucherName}</h3>
                    <p className="mt-2 text-sm font-bold text-[var(--primary-active)]">{formatDiscount(voucher)}</p>
                    <p className="mt-1 text-xs text-[var(--subtext)]">
                      Đơn tối thiểu {moneyAdapter.formatVND(voucher.minOrderValue)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                    <span className="rounded-md bg-[var(--primary-surface)] px-2.5 py-1 font-mono text-sm font-bold text-[var(--primary-active)]">{voucher.code}</span>
                    <span className="text-xs text-[var(--subtext)]">Dùng khi thanh toán</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có voucher áp dụng" description="Ưu đãi mới sẽ xuất hiện tại đây." icon="info" />
          )
        ) : user?.role === "ADMIN" || user?.role === "SELLER" ? (
          <div className="surface-card p-5 text-sm text-[var(--subtext)]">
            Ưu đãi dành cho khách mua hàng sẽ được áp dụng ở bước thanh toán.
          </div>
        ) : (
          <div className="surface-card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Đăng nhập để xem voucher đang áp dụng</h3>
              <p className="mt-1 text-sm text-[var(--subtext)]">Mã ưu đãi có thể nhập khi thanh toán đơn hàng.</p>
            </div>
            <Link href="/login" className="button button--secondary h-10 shrink-0 px-4 text-sm font-semibold">Đăng nhập</Link>
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="home-new-products-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Vừa lên kệ</p>
            <h2 id="home-new-products-title" className="text-2xl font-bold text-[var(--foreground)]">Sản phẩm mới</h2>
          </div>
          <Link href="/products" className="text-sm font-semibold text-[var(--primary-active)] hover:underline">Xem tất cả</Link>
        </div>
        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" aria-label="Đang tải sản phẩm">
            {[0, 1, 2, 3].map((item) => <div key={item} className="surface-card space-y-3 p-3"><Skeleton height={150} className="rounded-lg" /><Skeleton height={18} className="w-3/4" /><Skeleton height={18} className="w-1/2" /></div>)}
          </div>
        ) : productsError ? (
          <ErrorState title="Chưa tải được sản phẩm mới" description="Vui lòng thử tải lại danh sách sản phẩm." onRetry={() => { setProductsLoading(true); setProductsError(false); void loadProducts(); }} />
        ) : products.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {products.map((product) => <ProductCard key={product.product_id} product={product} />)}
          </div>
        ) : (
          <EmptyState title="Chưa có sản phẩm mới" description="Sản phẩm đang bán sẽ xuất hiện tại đây." icon="bag" />
        )}
      </section>
    </>
  );
}
