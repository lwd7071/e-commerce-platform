import { apiClient } from "@/lib/api/client";
import { features } from "@/lib/config/features";
import type {
  CreateReviewPayload,
  ReviewRecord,
  ReviewResult,
} from "./review.types";

export interface IReviewRepository {
  submitReview(payload: CreateReviewPayload): Promise<ReviewResult>;
  getOrderReviews(orderId: string): Promise<ReviewRecord[]>;
  isOrderReviewed(orderId: string): Promise<boolean>;
}

const REVIEW_STORAGE_KEY = "dino_reviews_store_v1";
const memoryReviewStore = new Map<string, string>();

export function validateReviewPayload(payload: CreateReviewPayload): void {
  if (!payload.order_id) {
    throw new Error("Mã đơn hàng không hợp lệ.");
  }
  if (!payload.reviews || payload.reviews.length === 0) {
    throw new Error("Vui lòng cung cấp ít nhất một đánh giá sản phẩm.");
  }

  for (const item of payload.reviews) {
    // Rating validation (1..5)
    if (
      typeof item.rating !== "number" ||
      !Number.isInteger(item.rating) ||
      item.rating < 1 ||
      item.rating > 5
    ) {
      throw new Error("Số sao đánh giá phải là số nguyên từ 1 đến 5.");
    }

    // Comment validation (10..500)
    const trimmedComment = item.comment ? item.comment.trim() : "";
    if (trimmedComment.length < 10) {
      throw new Error("Nhận xét chi tiết phải có tối thiểu 10 ký tự.");
    }
    if (trimmedComment.length > 500) {
      throw new Error("Nhận xét chi tiết không được vượt quá 500 ký tự.");
    }

    // Media validation (max 5)
    if (item.images && item.images.length > 5) {
      throw new Error("Tối đa 5 hình ảnh cho một đánh giá sản phẩm.");
    }
  }
}

export class MockReviewRepository implements IReviewRepository {
  private getStoredReviews(): ReviewRecord[] {
    let data: string | null = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        data = window.sessionStorage.getItem(REVIEW_STORAGE_KEY);
      } catch {
        // Fallback
      }
    } else {
      data = memoryReviewStore.get(REVIEW_STORAGE_KEY) || null;
    }

    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        // Fallback
      }
    }
    return [];
  }

  private saveStoredReviews(reviews: ReviewRecord[]): void {
    const serialized = JSON.stringify(reviews);
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(REVIEW_STORAGE_KEY, serialized);
      } catch {
        // Fallback
      }
    }
    memoryReviewStore.set(REVIEW_STORAGE_KEY, serialized);
  }

  async submitReview(payload: CreateReviewPayload): Promise<ReviewResult> {
    validateReviewPayload(payload);

    const currentReviews = this.getStoredReviews();

    // Check duplicate review (RB-LB09)
    for (const item of payload.reviews) {
      const alreadyReviewed = currentReviews.some(
        (r) => r.order_id === payload.order_id && r.order_item_id === item.order_item_id
      );
      if (alreadyReviewed) {
        const error = new Error("Sản phẩm này trong đơn hàng đã được đánh giá trước đó.");
        (error as unknown as { status: number; code: string }).status = 409;
        (error as unknown as { status: number; code: string }).code = "REVIEW_ALREADY_EXISTS";
        throw error;
      }
    }

    const newRecords: ReviewRecord[] = payload.reviews.map((item, idx) => ({
      id: `rev_${Date.now()}_${idx}`,
      order_id: payload.order_id,
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      product_name: item.product_name,
      variant_name: item.variant_name,
      rating: item.rating,
      comment: item.comment.trim(),
      images: item.images || [],
      is_anonymous: !!item.is_anonymous,
      created_at: new Date().toISOString(),
    }));

    this.saveStoredReviews([...currentReviews, ...newRecords]);

    return {
      success: true,
      message: "Gửi đánh giá thành công! Cảm ơn bạn đã phản hồi.",
      data: newRecords,
    };
  }

  async getOrderReviews(orderId: string): Promise<ReviewRecord[]> {
    const list = this.getStoredReviews();
    return list.filter((r) => r.order_id === orderId);
  }

  async isOrderReviewed(orderId: string): Promise<boolean> {
    const list = this.getStoredReviews();
    return list.some((r) => r.order_id === orderId);
  }
}

export class ApiReviewRepository implements IReviewRepository {
  private mockFallback = new MockReviewRepository();

  async submitReview(payload: CreateReviewPayload): Promise<ReviewResult> {
    validateReviewPayload(payload);

    try {
      const res = await apiClient.post<ReviewResult>("/reviews", payload);
      // Synchronize in mockFallback
      for (const item of payload.reviews) {
        await this.mockFallback.submitReview({
          order_id: payload.order_id,
          reviews: [item],
        }).catch(() => {});
      }
      return res;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const code = (err as { code?: string })?.code;
      const message = (err as Error)?.message || "";

      const isNetworkOrAuth =
        code === "NETWORK_ERROR" ||
        code === "UNAUTHORIZED" ||
        status === 0 ||
        status === 401 ||
        message.includes("Authentication required") ||
        message.includes("fetch failed");

      if (features.useMock() || isNetworkOrAuth) {
        return this.mockFallback.submitReview(payload);
      }
      throw err;
    }
  }

  async getOrderReviews(orderId: string): Promise<ReviewRecord[]> {
    try {
      const res = await apiClient.get<ReviewRecord[]>(`/orders/${orderId}/reviews`);
      if (Array.isArray(res)) return res;
      return this.mockFallback.getOrderReviews(orderId);
    } catch {
      return this.mockFallback.getOrderReviews(orderId);
    }
  }

  async isOrderReviewed(orderId: string): Promise<boolean> {
    try {
      const list = await this.getOrderReviews(orderId);
      return list.length > 0;
    } catch {
      return this.mockFallback.isOrderReviewed(orderId);
    }
  }
}

export const mockReviewRepository = new MockReviewRepository();
export const apiReviewRepository = new ApiReviewRepository();

export const reviewRepository: IReviewRepository = {
  submitReview: (payload) =>
    features.useMock() ? mockReviewRepository.submitReview(payload) : apiReviewRepository.submitReview(payload),
  getOrderReviews: (orderId) =>
    features.useMock() ? mockReviewRepository.getOrderReviews(orderId) : apiReviewRepository.getOrderReviews(orderId),
  isOrderReviewed: (orderId) =>
    features.useMock() ? mockReviewRepository.isOrderReviewed(orderId) : apiReviewRepository.isOrderReviewed(orderId),
};
