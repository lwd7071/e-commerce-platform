"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireOrder, WireOrderItem } from "@/lib/api/order.api";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton, ErrorState } from "@/components/ui/data-states";
import { ReviewMediaUpload } from "./review-media-upload";
import { reviewRepository } from "./review.repository";
import { RATING_LABELS, type ReviewRecord } from "./review.types";

interface ReviewScreenProps {
  orderId: string;
}

interface ItemReviewFormState {
  rating: number;
  hoverRating: number;
  comment: string;
  images: string[];
  isAnonymous: boolean;
  error: string | null;
}

export function ReviewScreen({ orderId }: ReviewScreenProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [order, setOrder] = useState<WireOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [existingReviews, setExistingReviews] = useState<ReviewRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Form states per order item ID
  const [formStates, setFormStates] = useState<Record<string, ItemReviewFormState>>({});

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      repositories.order().getOrderById(orderId),
      reviewRepository.getOrderReviews(orderId),
    ])
      .then(([orderData, reviewsData]) => {
        if (!isMounted) return;
        setOrder(orderData);
        setExistingReviews(reviewsData);

        // Initialize form states for each order item
        const initialStates: Record<string, ItemReviewFormState> = {};
        if (orderData.items && orderData.items.length > 0) {
          orderData.items.forEach((item) => {
            initialStates[item.id] = {
              rating: 5,
              hoverRating: 0,
              comment: "",
              images: [],
              isAnonymous: false,
              error: null,
            };
          });
        }
        setFormStates(initialStates);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setFetchError(
          err instanceof Error
            ? err.message
            : "Không thể tải thông tin đơn hàng để đánh giá."
        );
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const updateItemForm = (
    itemId: string,
    updater: Partial<ItemReviewFormState>
  ) => {
    setFormStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...updater,
      },
    }));
  };

  const handleSubmitAllReviews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !order.items || order.items.length === 0) return;

    let hasValidationError = false;
    const updatedStates = { ...formStates };

    // Validate each item (comment min 10 chars, rating 1..5)
    for (const item of order.items) {
      const state = updatedStates[item.id];
      if (!state) continue;

      const trimmed = state.comment.trim();
      if (trimmed.length < 10) {
        updatedStates[item.id] = {
          ...state,
          error: "Vui lòng viết nhận xét tối thiểu 10 ký tự cho sản phẩm này.",
        };
        hasValidationError = true;
      } else if (trimmed.length > 500) {
        updatedStates[item.id] = {
          ...state,
          error: "Nhận xét không được vượt quá 500 ký tự.",
        };
        hasValidationError = true;
      } else {
        updatedStates[item.id] = {
          ...state,
          error: null,
        };
      }
    }

    setFormStates(updatedStates);
    if (hasValidationError) return;

    setIsSubmitting(true);
    try {
      const payloadReviews = order.items.map((item) => {
        const state = updatedStates[item.id];
        return {
          order_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_name: item.variant_name,
          price: item.price,
          image_url: item.image_url,
          rating: state.rating,
          comment: state.comment.trim(),
          images: state.images,
          is_anonymous: state.isAnonymous,
        };
      });

      await reviewRepository.submitReview({
        order_id: order.id,
        reviews: payloadReviews,
      });

      setIsSubmittedSuccess(true);
      // Auto redirect after 2.5s
      setTimeout(() => {
        startTransition(() => {
          router.push("/orders");
        });
      }, 2500);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Gửi đánh giá không thành công. Vui lòng thử lại.";
      // Assign error to first item
      const firstItemId = order.items[0]?.id;
      if (firstItemId) {
        setFormStates((prev) => ({
          ...prev,
          [firstItemId]: {
            ...prev[firstItemId],
            error: message,
          },
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <div className="review-page max-w-3xl mx-auto space-y-6 pb-24">
        {/* Navigation Breadcrumb / Header */}
        <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/orders"
                className="text-xs font-semibold text-[var(--subtext)] hover:text-[var(--primary-active)] flex items-center gap-1 transition-colors"
              >
                ← Đơn hàng của tôi
              </Link>
              <span className="text-xs text-[var(--subtext)]">•</span>
              <p className="eyebrow m-0">Đánh giá sản phẩm (O-507)</p>
            </div>
            <h1 className="page-title">Đánh giá chất lượng sản phẩm</h1>
            <p className="page-description">
              Chia sẻ cảm nhận thực tế của bạn để giúp cộng đồng mua sắm tốt hơn.
            </p>
          </div>

          {order && (
            <div className="text-right shrink-0">
              <span className="text-xs text-[var(--subtext)] block">Mã đơn hàng</span>
              <strong className="font-mono text-sm text-[var(--foreground)]">
                #{order.id.slice(0, 8).toUpperCase()}
              </strong>
            </div>
          )}
        </header>

        {/* Loading State */}
        {loading ? (
          <div className="surface-card p-6 space-y-4" aria-busy="true">
            <Skeleton height={28} className="w-1/3" />
            <Skeleton height={80} />
            <Skeleton height={200} />
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Không tìm thấy đơn hàng"
            description={fetchError}
            onRetry={() => {
              setLoading(true);
              setFetchError(null);
              repositories
                .order()
                .getOrderById(orderId)
                .then(setOrder)
                .catch((e) => setFetchError(e.message))
                .finally(() => setLoading(false));
            }}
          />
        ) : !order ? (
          <ErrorState
            title="Đơn hàng không tồn tại"
            description="Mã đơn hàng không tìm thấy trong hệ thống."
            onRetry={() => {
              startTransition(() => {
                router.push("/orders");
              });
            }}
          />
        ) : order.status !== "COMPLETED" ? (
          /* Eligibility Guard: QD14 Invariant */
          <div className="surface-card p-8 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--warning-surface)] text-[var(--warning)] flex items-center justify-center border border-[var(--warning-border)]">
              <Icon name="warning" className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Chưa đủ điều kiện đánh giá (Quy tắc QD14)
              </h2>
              <p className="text-xs text-[var(--subtext)] leading-relaxed">
                Đơn hàng hiện đang ở trạng thái{" "}
                <strong className="text-[var(--foreground)] font-semibold">
                  <StatusBadge status={order.status} />
                </strong>
                . Theo quy định bảo vệ người mua QD14, bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được giao thành công (COMPLETED).
              </p>
            </div>
            <div className="pt-2">
              <Link href="/orders" className="button button--secondary text-xs py-2 px-4">
                Quay lại đơn hàng của tôi
              </Link>
            </div>
          </div>
        ) : existingReviews.length > 0 ? (
          /* Duplicate Review Guard: RB-LB09 */
          <div className="surface-card p-8 space-y-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--success-surface)] text-[var(--success)] flex items-center justify-center border border-[var(--success-border)]">
              <Icon name="check" className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Đơn hàng đã được đánh giá (Quy tắc RB-LB09)
              </h2>
              <p className="text-xs text-[var(--subtext)]">
                Bạn đã gửi phản hồi cho đơn hàng này. Mỗi sản phẩm trong một đơn hàng chỉ được đánh giá một lần.
              </p>
            </div>

            {/* List submitted reviews */}
            <div className="text-left space-y-3 pt-2">
              {existingReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-muted)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-semibold text-[var(--foreground)]">
                      {rev.product_name}
                    </strong>
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Icon key={i} name="star" className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--foreground)] bg-white p-2.5 rounded-lg border border-[var(--border)]">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                  {rev.images && rev.images.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {rev.images.map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={img}
                          alt="Ảnh đính kèm"
                          className="w-12 h-12 rounded-lg object-cover border border-[var(--border)]"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[var(--subtext)]">
                    <span>{rev.is_anonymous ? "Đánh giá ẩn danh" : "Đánh giá công khai"}</span>
                    <span>{new Date(rev.created_at).toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link href="/orders" className="button button--secondary text-xs py-2 px-4">
                Quay lại đơn hàng
              </Link>
            </div>
          </div>
        ) : isSubmittedSuccess ? (
          /* Success Feedback Card */
          <div className="surface-card p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--success-surface)] text-[var(--success)] flex items-center justify-center mx-auto border border-[var(--success-border)]">
              <Icon name="check" className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Gửi đánh giá thành công!
            </h2>
            <p className="text-xs text-[var(--subtext)] max-w-md mx-auto leading-relaxed">
              Cảm ơn bạn đã đóng góp phản hồi quý báu cho cửa hàng và cộng đồng mua sắm Dino.
              Đánh giá của bạn đã được lưu trữ thành công.
            </p>
            <p className="text-[11px] text-[var(--primary-active)] font-medium">
              Đang quay lại trang đơn hàng của bạn...
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  startTransition(() => {
                    router.push("/orders");
                  });
                }}
              >
                Xem đơn hàng ngay
              </Button>
            </div>
          </div>
        ) : (
          /* Active Review Form */
          <form onSubmit={handleSubmitAllReviews} className="space-y-6">
            {/* Gated API Runtime Notification */}
            <div className="notice notice--info" role="status">
              <Icon name="info" />
              <div className="text-xs">
                <strong className="block font-semibold">
                  Chế độ đánh giá Dino (O-507 & P-607c)
                </strong>
                <span>
                  Đánh giá và hình ảnh thực tế của bạn sẽ được kiểm tra quy tắc hợp lệ (QD14, RB-LB09) và lưu trữ trực tiếp.
                </span>
              </div>
            </div>

            {/* Render form per item */}
            {order.items &&
              order.items.map((item: WireOrderItem, itemIdx: number) => {
                const state = formStates[item.id] || {
                  rating: 5,
                  hoverRating: 0,
                  comment: "",
                  images: [],
                  isAnonymous: false,
                  error: null,
                };
                const activeStar = state.hoverRating || state.rating;

                return (
                  <section
                    key={item.id}
                    className="surface-card p-6 space-y-6"
                    aria-labelledby={`item-title-${item.id}`}
                  >
                    {/* Item header */}
                    <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                      <div className="w-16 h-16 rounded-xl bg-[var(--card-muted)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center text-xs text-[var(--subtext)]">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>Ảnh SP</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary-active)] block mb-0.5">
                          Sản phẩm #{itemIdx + 1}
                        </span>
                        <h2
                          id={`item-title-${item.id}`}
                          className="text-sm font-bold text-[var(--foreground)] truncate"
                        >
                          {item.product_name}
                        </h2>
                        <p className="text-xs text-[var(--subtext)] mt-0.5">
                          Phân loại: {item.variant_name || "Mặc định"} • Số lượng: {item.quantity}
                        </p>
                        <span className="text-xs font-bold text-[var(--foreground)] mt-1 block">
                          {moneyAdapter.formatVND(item.price)}
                        </span>
                      </div>
                    </div>

                    {/* Rating stars */}
                    <div className="text-center space-y-2 py-1">
                      <span className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider block">
                        Đánh giá chất lượng sản phẩm
                      </span>

                      <div
                        className="flex items-center justify-center gap-2 py-1"
                        role="radiogroup"
                        aria-label={`Chấm điểm số sao cho ${item.product_name}`}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            role="radio"
                            aria-checked={state.rating === star}
                            aria-label={`${star} sao - ${RATING_LABELS[star]}`}
                            onMouseEnter={() =>
                              updateItemForm(item.id, { hoverRating: star })
                            }
                            onMouseLeave={() =>
                              updateItemForm(item.id, { hoverRating: 0 })
                            }
                            onClick={() =>
                              updateItemForm(item.id, { rating: star })
                            }
                            className="p-1.5 rounded-xl transition-transform hover:scale-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                          >
                            <Icon
                              name="star"
                              className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                                star <= activeStar
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-transparent text-[var(--border)] hover:text-[var(--primary-border)]"
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      <div className="text-xs font-semibold text-[var(--primary-active)] bg-[var(--primary-surface)] px-4 py-1.5 rounded-full inline-block border border-[var(--primary-border)]">
                        {RATING_LABELS[activeStar]}
                      </div>
                    </div>

                    {/* Detailed Comment Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`comment-${item.id}`}
                          className="text-xs font-bold text-[var(--foreground)]"
                        >
                          Nhận xét chi tiết <span className="text-[var(--danger)]">*</span>
                        </label>
                        <span
                          className={`text-[11px] tabular-nums ${
                            state.comment.trim().length >= 10
                              ? "text-[var(--success)]"
                              : "text-[var(--subtext)]"
                          }`}
                        >
                          {state.comment.length}/500 ký tự (Tối thiểu 10 ký tự)
                        </span>
                      </div>

                      <textarea
                        id={`comment-${item.id}`}
                        rows={4}
                        maxLength={500}
                        value={state.comment}
                        onChange={(e) =>
                          updateItemForm(item.id, {
                            comment: e.target.value,
                            error: null,
                          })
                        }
                        placeholder="Hãy chia sẻ cảm nhận về chất lượng sản phẩm, độ đúng với mô tả, đóng gói và sự hài lòng của bạn..."
                        className="w-full text-xs p-3.5 rounded-xl border border-[var(--border)] focus:border-[var(--primary-active)] focus:ring-1 focus:ring-[var(--primary-active)] outline-none transition-all resize-none bg-[var(--card)] text-[var(--foreground)]"
                      />

                      {state.error && (
                        <div
                          className="p-2.5 bg-[var(--danger-surface)] border border-[var(--danger-border)] rounded-lg text-xs text-[var(--danger)] flex items-center gap-2"
                          role="alert"
                        >
                          <Icon name="warning" className="w-4 h-4 shrink-0" />
                          <span>{state.error}</span>
                        </div>
                      )}
                    </div>

                    {/* Media Upload & Preview Component (P-607c) */}
                    <ReviewMediaUpload
                      images={state.images}
                      onChange={(newImgs) =>
                        updateItemForm(item.id, { images: newImgs })
                      }
                      maxImages={5}
                    />

                    {/* Anonymous Checkbox */}
                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--foreground)] block">
                          Đánh giá ẩn danh
                        </span>
                        <span className="text-[11px] text-[var(--subtext)]">
                          Tên của bạn sẽ được bảo mật dưới dạng n***n trên trang sản phẩm.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={state.isAnonymous}
                        onChange={(e) =>
                          updateItemForm(item.id, {
                            isAnonymous: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[var(--primary-active)] cursor-pointer"
                        id={`anonymous-${item.id}`}
                      />
                    </div>
                  </section>
                );
              })}

            {/* Actions: Cancel & Submit */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => {
                  startTransition(() => {
                    router.push("/orders");
                  });
                }}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full sm:w-auto px-8"
              >
                Gửi toàn bộ đánh giá
              </Button>
            </div>
          </form>
        )}
      </div>
    </ProtectedPage>
  );
}
