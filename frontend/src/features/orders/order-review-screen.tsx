"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { repositories } from "../../lib/repositories/repository-factory";
import { type WireOrder } from "../../lib/api/order.api";
import { isOrderEligibleForReview, validateReviewInput } from "./order-review-validator";
import { StarRating } from "../../components/ui/star-rating";
import { FileUploadZone } from "../../components/ui/file-upload-zone";
import { TextArea } from "../../components/ui/form-controls";
import { Button } from "../../components/ui/button";
import { Skeleton, ErrorState } from "../../components/ui/data-states";
import { useToast } from "../../components/ui/toast";
import { moneyAdapter } from "../../lib/adapters/money.adapter";
import { features } from "../../lib/config/features";

interface OrderReviewScreenProps {
  orderId: string;
}

export function OrderReviewScreen({ orderId }: OrderReviewScreenProps) {
  const router = useRouter();
  const showToast = useToast();

  const [order, setOrder] = useState<WireOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-item review state map
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [mediaUrls, setMediaUrls] = useState<Record<string, string[]>>({});
  const [submittingItems, setSubmittingItems] = useState<Record<string, boolean>>({});
  const [reviewedItems, setReviewedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    repositories
      .order()
      .getOrderById(orderId)
      .then((data) => {
        if (!isMounted) return;
        setOrder(data);
        // Default ratings to 5
        const defaultRatings: Record<string, number> = {};
        (data.items || []).forEach((item) => {
          defaultRatings[item.id] = 5;
        });
        setRatings(defaultRatings);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Không tìm thấy đơn hàng");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleSubmitItemReview = async (orderItemId: string) => {
    const rating = ratings[orderItemId] || 5;
    const comment = comments[orderItemId] || "";
    const urls = mediaUrls[orderItemId] || [];

    const validation = validateReviewInput({ rating, comment, media_urls: urls });
    if (!validation.valid) {
      showToast(validation.errors.rating || "Dữ liệu đánh giá chưa hợp lệ", "error");
      return;
    }

    setSubmittingItems((prev) => ({ ...prev, [orderItemId]: true }));

    try {
      await repositories.review().createReview({
        order_id: orderId,
        order_item_id: orderItemId,
        product_id: order?.items?.find((item) => item.id === orderItemId)?.product_id,
        rating,
        comment,
        media_urls: urls,
      });

      showToast("Cảm ơn bạn đã gửi đánh giá sản phẩm!", "success");
      setReviewedItems((prev) => ({ ...prev, [orderItemId]: true }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi đánh giá thất bại";
      showToast(msg, "error");
    } finally {
      setSubmittingItems((prev) => ({ ...prev, [orderItemId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 surface-card p-6">
        <Skeleton height={28} className="w-1/3" />
        <Skeleton height={100} className="w-full" />
        <Skeleton height={100} className="w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Không thể tải thông tin đơn hàng"
        description={error || "Vui lòng kiểm tra lại mã đơn hàng"}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const eligible = isOrderEligibleForReview(order.status);
  const items = order.items || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/orders"
          className="text-xs text-[var(--subtext)] hover:text-[var(--foreground)]"
        >
          ← Quay lại danh sách đơn hàng
        </Link>
        <h1 className="page-title mt-1">Đánh Giá Sản Phẩm</h1>
        <p className="page-description">
          Mã đơn hàng: <span className="font-mono font-semibold">{order.id.slice(0, 8)}</span>
        </p>
      </div>

      {!eligible ? (
        <div className="surface-card p-6 text-center space-y-3">
          <div className="inline-block p-3 rounded-full bg-[var(--warning-surface)] text-[var(--warning-text)]">
            ⚠️
          </div>
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Đơn hàng chưa hoàn tất giao hàng
          </h2>
          <p className="text-sm text-[var(--subtext)]">
            Bạn chỉ có thể đánh giá và nhận xét chất lượng sau khi đơn hàng đã ở trạng thái{" "}
            <strong>Đã giao thành công (COMPLETED)</strong>.
          </p>
          <div className="pt-2">
            <Button variant="secondary" onClick={() => router.push("/orders")}>
              Quay lại danh sách đơn hàng
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-[var(--subtext)]">
          Đơn hàng không có sản phẩm nào để đánh giá.
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const isDone = reviewedItems[item.id];
            const isSubmitting = submittingItems[item.id];

            return (
              <div key={item.id} className="surface-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="font-bold text-sm text-[var(--foreground)]">
                      {item.product_name}
                    </h2>
                    <p className="text-xs text-[var(--subtext)]">
                      Phân loại: {item.variant_name} • Số lượng: {item.quantity} • Giá:{" "}
                      {moneyAdapter.formatVND(item.price)}
                    </p>
                  </div>
                  {isDone && (
                    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[var(--success-surface)] text-[var(--success-text)]">
                      ✓ Đã gửi đánh giá
                    </span>
                  )}
                </div>

                {!isDone ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Chất lượng sản phẩm
                      </label>
                      <StarRating
                        value={ratings[item.id] || 5}
                        onChange={(val) =>
                          setRatings((prev) => ({ ...prev, [item.id]: val }))
                        }
                        size="lg"
                        showValue
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`comment-${item.id}`}
                        className="block text-xs font-bold text-[var(--foreground)] mb-1"
                      >
                        Nhận xét chi tiết
                      </label>
                      <TextArea
                        id={`comment-${item.id}`}
                        rows={3}
                        placeholder="Hãy chia sẻ trải nghiệm thực tế về sản phẩm để giúp cộng đồng mua sắm tốt hơn..."
                        value={comments[item.id] || ""}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                        Hình ảnh thực tế (tùy chọn)
                      </label>
                      {features.useMock() ? (
                        <FileUploadZone
                          values={mediaUrls[item.id] || []}
                          purpose="review"
                          onChange={(urls) =>
                            setMediaUrls((prev) => ({ ...prev, [item.id]: urls }))
                          }
                          maxFiles={3}
                        />
                      ) : (
                        <p className="text-xs text-[var(--subtext)]" role="status">
                          Ảnh đánh giá chưa khả dụng; bạn vẫn có thể gửi sao và nhận xét.
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="primary"
                        disabled={isSubmitting}
                        onClick={() => handleSubmitItemReview(item.id)}
                        className="h-10 px-5 text-xs font-bold shadow-xs"
                      >
                        {isSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--subtext)] italic">
                    Đánh giá của bạn đã được ghi nhận. Cảm ơn bạn đã đóng góp!
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
