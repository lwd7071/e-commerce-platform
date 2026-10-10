"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem } from "@/lib/api/catalog.api";
import type { WireVoucher } from "@/lib/api/voucher.api";
import { repositories } from "@/lib/repositories/repository-factory";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";

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
  const visualProducts = products.slice(0, 4);

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
      <section className="market-hero" aria-labelledby="market-hero-title">
        <div className="market-hero__copy">
          <p className="market-hero__tag">Chọn gu của bạn <span aria-hidden="true">↗</span></p>
          <h1 id="market-hero-title">Tìm món hay.<br />Mua sắm có gu.</h1>
          <p className="market-hero__description">
            Tìm món đồ bạn cần, xem giá và tình trạng hàng rõ ràng từ các gian hàng đang hoạt động.
          </p>
          <div className="market-hero__actions">
            <Link href="/products" className="button button--primary h-11 px-6 text-sm font-bold">
              Khám phá sản phẩm
            </Link>
            {isSeller ? (
              <Link href="/seller/products" className="button button--secondary h-11 px-5 text-sm font-semibold">
                Kênh Người Bán
              </Link>
            ) : (
              <a href="#uu-dai" className="market-hero__text-link">Xem ưu đãi đang có</a>
            )}
          </div>
        </div>
        <div className="market-hero__feature">
          {productsLoading ? (
            <div className="market-hero__mosaic market-hero__mosaic--loading" aria-label="Đang tải sản phẩm">
              {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="market-hero__tile-skeleton" />)}
            </div>
          ) : productsError ? (
            <ErrorState title="Chưa tải được sản phẩm" description="Thử tải lại để xem sản phẩm từ gian hàng." onRetry={() => { setProductsLoading(true); setProductsError(false); void loadProducts(); }} />
          ) : visualProducts.length ? (
            <div className="market-hero__mosaic" aria-label="Một số sản phẩm mới">
              {visualProducts.map((product, index) => {
                const imageUrl = product.image_url?.trim();
                return (
                  <Link
                    key={product.product_id}
                    href={`/products/${product.product_id}`}
                    className={`market-hero__tile market-hero__tile--${index + 1}`}
                    aria-label={`Xem ${product.product_name}, giá từ ${moneyAdapter.formatVND(product.min_price)}`}
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.product_name}
                        fill
                        sizes="(max-width: 767px) 42vw, (max-width: 1100px) 28vw, 20vw"
                        className="market-hero__tile-image"
                        priority={index === 0}
                      />
                    ) : (
                      <span className="market-hero__tile-empty" aria-hidden="true" />
                    )}
                    <span className="market-hero__tile-caption">
                      <strong>{product.product_name}</strong>
                      <span>{moneyAdapter.formatVND(product.min_price)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="market-hero__mosaic market-hero__mosaic--empty" aria-hidden="true">
              <div className="market-hero__tile-empty" />
              <div className="market-hero__tile-empty" />
              <div className="market-hero__tile-empty" />
              <div className="market-hero__tile-empty" />
            </div>
          )}
        </div>
      </section>

      <section id="uu-dai" className="scroll-mt-24 space-y-4" aria-labelledby="home-vouchers-title">
        <div className="voucher-heading">
          <div>
            <span className="voucher-heading__mark" aria-hidden="true">Dino / Ưu đãi</span>
            <h2 id="home-vouchers-title">Mã tốt, giá dễ chịu</h2>
            <p>Chọn mã phù hợp và nhập ở bước thanh toán.</p>
          </div>
        </div>

        {isAuthLoading || (canViewVouchers && vouchersLoading) ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đang tải ưu đãi">
            {[0, 1, 2].map((item) => <Skeleton key={item} height={132} className="rounded-xl" />)}
          </div>
        ) : canViewVouchers ? (
          vouchersError ? (
            <ErrorState title="Chưa tải được ưu đãi" description="Vui lòng thử tải lại danh sách voucher." onRetry={() => { setVouchersLoading(true); setVouchersError(false); void loadVouchers(); }} />
          ) : vouchers.length ? (
            <div className="voucher-grid">
              {vouchers.map((voucher, index) => (
                <article key={voucher.voucherId} className={`voucher-ticket${index === 0 ? " voucher-ticket--featured" : ""}`}>
                  <div className="voucher-ticket__amount" aria-hidden="true">
                    {voucher.discountType === "PERCENT" ? `${Number(voucher.discountValue)}%` : moneyAdapter.formatVND(voucher.discountValue)}
                  </div>
                  <div className="voucher-ticket__details">
                    <p className="voucher-ticket__scope">
                      {voucher.scope === "PLATFORM" ? "Ưu đãi toàn sàn" : "Ưu đãi gian hàng"}
                    </p>
                    <h3>{voucher.voucherName}</h3>
                    <p className="voucher-ticket__discount">{formatDiscount(voucher)}</p>
                    <p className="voucher-ticket__minimum">
                      Đơn từ {moneyAdapter.formatVND(voucher.minOrderValue)}
                    </p>
                  </div>
                  <div className="voucher-ticket__code">
                    <span>Mã</span>
                    <strong>{voucher.code}</strong>
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
          <div className="voucher-guest">
            <div>
              <span className="voucher-heading__mark">Khu vực ưu đãi</span>
              <h3>Đăng nhập để kiểm tra voucher hiện có</h3>
              <p>Mã đang áp dụng sẽ hiện tại đây và có thể nhập khi thanh toán.</p>
            </div>
            <Link href="/login" className="button button--primary h-11 shrink-0 px-5 text-sm font-semibold">Đăng nhập</Link>
          </div>
        )}
      </section>

    </>
  );
}
