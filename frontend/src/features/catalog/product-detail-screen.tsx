"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireProductVariant } from "@/lib/api/catalog.api";
import { useQuery } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { StarRating } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ChatWidget } from "@/components/chat/chat-widget";
import { QueryProvider } from "@/lib/query/query-provider";

import { TierBadge } from "@/components/ui/tier-badge";

type Props = {
  productId: string;
};

export function ProductDetailScreen(props: Props) {
  return (
    <QueryProvider>
      <InnerProductDetailScreen {...props} />
    </QueryProvider>
  );
}

function InnerProductDetailScreen({ productId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const showToast = useToast();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const {
    data: product,
    isLoading,
    error: queryErr,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: queryKeys.catalog.detail(productId),
    queryFn: () => repositories.catalog().getProductById(productId),
  });

  const selectedVariant = product?.variants.find((variant) => variant.variant_id === selectedVariantId)
    ?? product?.variants.find((variant) => variant.stock_quantity > 0)
    ?? product?.variants[0]
    ?? null;

  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: queryKeys.catalog.reviews(productId),
    queryFn: () => repositories.review().getReviewsByProduct(productId),
  });

  const error = queryErr instanceof Error ? queryErr.message : queryErr ? "Không thể tải chi tiết sản phẩm." : null;

  const handleRetry = () => {
    refetchProduct();
  };

  const handleVariantSelect = (variant: WireProductVariant) => {
    setSelectedVariantId(variant.variant_id);
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
      if (user?.id) {
        await getQueryClient().invalidateQueries({ queryKey: queryKeys.cart.items(user.id) });
      }
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

  if (error && !product) {
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

  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount) * 10) / 10
      : 0;

  const productImages =
    product.images && product.images.length > 0
      ? product.images.map((img) => img.image_url)
      : product.image_url
      ? [product.image_url]
      : [fallbackImage];

  const currentDisplayImage = selectedImage || productImages[0] || fallbackImage;

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
          {/* Image Showcase (B-105: stable dimensions, next/image, alt text) */}
          <div className="space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--card-muted)] border border-[var(--border)]">
              <Image
                src={currentDisplayImage}
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
            {productImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {productImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border transition-all shrink-0 ${
                      currentDisplayImage === imgUrl
                        ? "border-[var(--primary-active)] ring-2 ring-[var(--primary-surface)]"
                        : "border-[var(--border)] hover:border-[var(--subtext)]"
                    }`}
                  >
                    <Image
                      src={imgUrl}
                      alt={`${product.product_name} - ảnh ${idx + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-md bg-[var(--primary-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-active)]">
                    Chính hãng Dino
                  </span>
                  {product.shop_tier && product.shop_tier !== "STANDARD" && (
                    <TierBadge tier={product.shop_tier} />
                  )}
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-[var(--foreground)]">
                  {product.product_name}
                </h1>
                {/* Real rating display (C-205) */}
                <div className="mt-2 flex items-center gap-2">
                  {reviewCount > 0 ? (
                    <>
                      <StarRating value={averageRating} readOnly size="sm" />
                      <span className="text-xs font-bold text-[var(--foreground)]">
                        {averageRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-[var(--subtext)]">
                        ({reviewCount} đánh giá)
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--subtext)]">
                      Chưa có đánh giá nào cho sản phẩm này
                    </span>
                  )}
                </div>
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
            <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                variant="primary"
                disabled={isOutOfStock || isSubmitting}
                onClick={handleAddToCart}
                leadingIcon={!isSubmitting && !isOutOfStock ? <Icon name="bag" className="w-5 h-5 shrink-0" /> : undefined}
                className="flex-1 h-12 text-sm font-bold shadow-sm hover:shadow active:scale-[0.99] transition-all whitespace-nowrap"
              >
                {isSubmitting ? "Đang xử lý..." : isOutOfStock ? "Tạm Hết Hàng" : "Thêm Vào Giỏ Hàng"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!user) {
                    showToast("Vui lòng đăng nhập để chat với Shop", "info");
                    router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
                    return;
                  }
                  setIsChatOpen(true);
                }}
                leadingIcon={<Icon name="chat" className="w-5 h-5 shrink-0 text-[var(--primary)]" />}
                className="h-12 px-6 text-sm font-semibold border-2 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-subtle)] active:scale-[0.99] transition-all whitespace-nowrap"
              >
                Chat với Shop
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

        {/* Customer Reviews Section (C-205) */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Đánh Giá Sản Phẩm</h2>
              <p className="text-xs text-[var(--subtext)] mt-0.5">
                Nhận xét thực tế từ những người mua đã hoàn thành đơn hàng
              </p>
            </div>
            {reviewCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2">
                <div className="text-2xl font-black text-[var(--primary-active)]">
                  {averageRating.toFixed(1)}
                </div>
                <div className="space-y-0.5">
                  <StarRating value={averageRating} readOnly size="sm" />
                  <p className="text-xs text-[var(--subtext)]">{reviewCount} lượt đánh giá</p>
                </div>
              </div>
            )}
          </div>

          {isLoadingReviews ? (
            <div className="space-y-3">
              <Skeleton height={20} className="w-1/4" />
              <Skeleton height={60} className="w-full" />
            </div>
          ) : reviewCount === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center bg-[var(--card-muted)]">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Chưa có đánh giá nào cho sản phẩm này
              </p>
              <p className="mt-1 text-xs text-[var(--subtext)]">
                Đánh giá sẽ xuất hiện khi người mua hoàn thành đơn hàng và để lại nhận xét.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {reviews.map((rev) => (
                <div key={rev.review_id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Người mua đã xác minh
                      </span>
                    </div>
                    <span className="text-xs text-[var(--subtext)]">
                      {new Date(rev.created_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <StarRating value={rev.rating} readOnly size="sm" />
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{rev.comment}</p>
                  {rev.media_urls && rev.media_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {rev.media_urls.map((url, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                          <Image src={url} alt={`Ảnh đánh giá ${i + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        productContext={
          product
            ? {
                productId: product.product_id,
                shopId: product.shop_id,
                productName: product.product_name,
                price: selectedVariant?.price ?? product.variants?.[0]?.price,
                imageUrl: product.image_url ?? selectedImage,
                totalStock: product.variants?.reduce((sum, v) => sum + (v.stock_quantity || 0), 0),
              }
            : null
        }
      />
    </div>
  );
}
