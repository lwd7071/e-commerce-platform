"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductDetail, WireProductVariant } from "@/lib/api/catalog.api";
import { useToast } from "@/components/ui/toast";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Props = {
  productId: string;
};

export function ProductDetailScreen({ productId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const showToast = useToast();

  const [product, setProduct] = useState<WireCatalogProductDetail | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<WireProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    repositories.catalog().getProductById(productId)
      .then((data) => {
        if (ignore) return;
        setProduct(data);
        if (data.variants && data.variants.length > 0) {
          const preferred = data.variants.find((v) => v.stock_quantity > 0) || data.variants[0];
          setSelectedVariant(preferred);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : "Không thể tải chi tiết sản phẩm.";
        setError(msg);
        setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [productId]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    repositories.catalog().getProductById(productId)
      .then((data) => {
        setProduct(data);
        if (data.variants && data.variants.length > 0) {
          const preferred = data.variants.find((v) => v.stock_quantity > 0) || data.variants[0];
          setSelectedVariant(preferred);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Không thể tải chi tiết sản phẩm.";
        setError(msg);
        setIsLoading(false);
      });
  };

  const handleVariantSelect = (variant: WireProductVariant) => {
    setSelectedVariant(variant);
    // If current quantity exceeds new variant stock, clamp it
    if (quantity > variant.stock_quantity) {
      setQuantity(Math.max(1, variant.stock_quantity));
    }
  };

  const handleQuantityChange = (delta: number) => {
    if (!selectedVariant) return;
    const maxStock = selectedVariant.stock_quantity;
    if (maxStock <= 0) return;

    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > maxStock) return maxStock;
      return next;
    });
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) return;

    // Check if user is authenticated (B-401 & F-102 Guest ReturnTo Contract)
    if (!user) {
      showToast("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng", "info", "Yêu cầu đăng nhập");
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnTo=${returnUrl}`);
      return;
    }

    if (selectedVariant.stock_quantity <= 0) {
      showToast("Biến thể này hiện đã hết hàng", "error", "Hết hàng");
      return;
    }

    setIsSubmitting(true);
    try {
      await repositories.buyer().addToCart(selectedVariant.variant_id, quantity);
      showToast(
        `Đã thêm ${quantity} sản phẩm vào giỏ hàng thành công!`,
        "success",
        "Giỏ hàng"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể thêm vào giỏ hàng. Vui lòng thử lại.";
      showToast(msg, "error", "Lỗi thêm giỏ hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton height={24} className="w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton height={420} className="w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton height={36} className="w-3/4" />
            <Skeleton height={28} className="w-1/3" />
            <Skeleton height={80} className="w-full" />
            <Skeleton height={44} className="w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Không thể tải chi tiết sản phẩm"
        description={error}
        onRetry={handleRetry}
      />
    );
  }

  if (!product || product.status !== "ACTIVE") {
    return (
      <EmptyState
        icon="bag"
        title="Không tìm thấy sản phẩm"
        description="Sản phẩm này không tồn tại hoặc đã ngừng kinh doanh."
        action={{
          label: "Quay lại danh mục",
          onClick: () => router.push("/products"),
        }}
      />
    );
  }

  const isOutOfStock = !selectedVariant || selectedVariant.stock_quantity <= 0;
  const currentPrice = selectedVariant
    ? moneyAdapter.formatVND(selectedVariant.price)
    : "Đang cập nhật";

  const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800";

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <nav aria-label="Điều hướng phân cấp" className="flex items-center gap-2 text-xs text-[var(--subtext)]">
        <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
          Trang chủ
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/products" className="hover:text-[var(--foreground)] transition-colors">
          Sản phẩm
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--foreground)] font-medium line-clamp-1">
          {product.product_name}
        </span>
      </nav>

      {/* Main Product Layout */}
      <div className="surface-card p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Showcase (GAP-04: Graceful placeholder) */}
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--card-muted)] border border-[var(--border)]">
            <Image
              src={fallbackImage}
              alt={product.product_name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <span className="rounded-full bg-[var(--danger)] px-4 py-1.5 text-sm font-bold text-white shadow-md">
                  Tạm hết hàng
                </span>
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-md bg-[var(--primary-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-active)]">
                  Chính hãng Dino
                </span>
                <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-[var(--foreground)]">
                  {product.product_name}
                </h1>
              </div>

              {/* Price display */}
              <div className="rounded-xl bg-[var(--card-muted)] p-4">
                <div className="text-2xl md:text-3xl font-extrabold text-[var(--primary-active)]">
                  {currentPrice}
                </div>
                <div className="mt-1 text-xs text-[var(--subtext)]">
                  Giá đã bao gồm thuế VAT (nếu có)
                </div>
              </div>

              {/* Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">
                      Lựa chọn phân loại:
                    </span>
                    {selectedVariant && (
                      <span className="text-[var(--subtext)]">
                        {selectedVariant.stock_quantity > 0
                          ? `Kho: ${selectedVariant.stock_quantity}`
                          : "Hết hàng"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {product.variants.map((v) => {
                      const isSelected = selectedVariant?.variant_id === v.variant_id;
                      const disabled = v.stock_quantity <= 0;
                      const label = v.variant_value
                        ? `${v.variant_name}: ${v.variant_value}`
                        : v.variant_name || `Lựa chọn ${v.sku || ""}`;

                      return (
                        <button
                          key={v.variant_id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleVariantSelect(v)}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                            isSelected
                              ? "border-[var(--primary-active)] bg-[var(--primary-surface)] text-[var(--primary-active)] shadow-xs"
                              : disabled
                              ? "border-[var(--border)] bg-[var(--card-muted)] text-[var(--subtext)] opacity-50 cursor-not-allowed line-through"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary-border)]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="space-y-2 pt-2">
                <span className="block text-xs font-semibold text-[var(--foreground)]">
                  Số lượng:
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <button
                      type="button"
                      disabled={isOutOfStock || quantity <= 1}
                      onClick={() => handleQuantityChange(-1)}
                      className="h-9 w-9 flex items-center justify-center text-sm font-bold text-[var(--subtext)] hover:text-[var(--foreground)] disabled:opacity-40"
                      aria-label="Giảm số lượng"
                    >
                      -
                    </button>
                    <span className="h-9 min-w-10 px-2 flex items-center justify-center text-sm font-semibold">
                      {isOutOfStock ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock || quantity >= (selectedVariant?.stock_quantity ?? 1)}
                      onClick={() => handleQuantityChange(1)}
                      className="h-9 w-9 flex items-center justify-center text-sm font-bold text-[var(--subtext)] hover:text-[var(--foreground)] disabled:opacity-40"
                      aria-label="Tăng số lượng"
                    >
                      +
                    </button>
                  </div>
                  {selectedVariant && selectedVariant.stock_quantity > 0 && (
                    <span className="text-xs text-[var(--subtext)]">
                      Tối đa {selectedVariant.stock_quantity} sản phẩm
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                disabled={isOutOfStock || isSubmitting}
                onClick={handleAddToCart}
                className="flex-1 h-12 text-sm font-bold shadow-md"
              >
                {isSubmitting ? (
                  "Đang xử lý..."
                ) : isOutOfStock ? (
                  "Tạm Hết Hàng"
                ) : (
                  <>
                    <Icon name="bag" />
                    Thêm Vào Giỏ Hàng
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] space-y-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Mô Tả Sản Phẩm</h2>
          <div className="text-sm leading-relaxed text-[var(--subtext)] whitespace-pre-line max-w-4xl">
            {product.description || "Chưa có mô tả chi tiết cho sản phẩm này."}
          </div>
        </div>
      </div>
    </div>
  );
}
