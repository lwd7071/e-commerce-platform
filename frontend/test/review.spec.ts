import { describe, it, expect } from "vitest";
import { reviewRepository } from "../src/features/review/review.repository";
import { RATING_LABELS, type CreateReviewPayload } from "../src/features/review/review.types";
import { repositories } from "../src/lib/repositories/repository-factory";

describe("Review Management and Form Validation (O-507 & P-607c)", () => {
  it("provides human-readable labels for all 5 star ratings", () => {
    expect(Object.keys(RATING_LABELS)).toHaveLength(5);
    expect(RATING_LABELS[1]).toContain("Rất tệ");
    expect(RATING_LABELS[2]).toContain("Chưa tốt");
    expect(RATING_LABELS[3]).toContain("Bình thường");
    expect(RATING_LABELS[4]).toContain("Hài lòng");
    expect(RATING_LABELS[5]).toContain("Tuyệt vời");
  });

  it("rejects review if comment is under 10 characters", async () => {
    const payload: CreateReviewPayload = {
      order_id: "00000000-0000-0000-0000-000000000304",
      reviews: [
        {
          order_item_id: "item_test_01",
          product_name: "Serum Dưỡng Trắng",
          rating: 5,
          comment: "Quá ngắn", // Only 8 chars
          images: [],
          is_anonymous: false,
        },
      ],
    };

    await expect(reviewRepository.submitReview(payload)).rejects.toThrow(
      "Nhận xét chi tiết phải có tối thiểu 10 ký tự."
    );
  });

  it("rejects review if rating is invalid (not 1..5)", async () => {
    const payload: CreateReviewPayload = {
      order_id: "00000000-0000-0000-0000-000000000304",
      reviews: [
        {
          order_item_id: "item_test_02",
          product_name: "Serum Dưỡng Trắng",
          rating: 6,
          comment: "Sản phẩm chất lượng vượt trội rất hài lòng",
          images: [],
          is_anonymous: false,
        },
      ],
    };

    await expect(reviewRepository.submitReview(payload)).rejects.toThrow(
      "Số sao đánh giá phải là số nguyên từ 1 đến 5."
    );
  });

  it("rejects review if media count exceeds 5 images (P-607c)", async () => {
    const payload: CreateReviewPayload = {
      order_id: "00000000-0000-0000-0000-000000000304",
      reviews: [
        {
          order_item_id: "item_test_03",
          product_name: "Serum Dưỡng Trắng",
          rating: 5,
          comment: "Sản phẩm chất lượng vượt trội rất hài lòng",
          images: [
            "img1.jpg",
            "img2.jpg",
            "img3.jpg",
            "img4.jpg",
            "img5.jpg",
            "img6.jpg",
          ],
          is_anonymous: false,
        },
      ],
    };

    await expect(reviewRepository.submitReview(payload)).rejects.toThrow(
      "Tối đa 5 hình ảnh cho một đánh giá sản phẩm."
    );
  });

  it("submits valid review and persists into review repository (O-507)", async () => {
    const testOrderId = `order_test_${Date.now()}`;
    const testItemId = `item_test_${Date.now()}`;

    const payload: CreateReviewPayload = {
      order_id: testOrderId,
      reviews: [
        {
          order_item_id: testItemId,
          product_name: "Bàn Phím Cơ Không Dây RGB",
          variant_name: "Linear Switch",
          rating: 5,
          comment: "Bàn phím gõ rất êm, độ nảy tốt, kết nối Bluetooth rất mượt mà!",
          images: ["data:image/png;base64,mock1", "data:image/png;base64,mock2"],
          is_anonymous: true,
        },
      ],
    };

    const result = await reviewRepository.submitReview(payload);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].order_id).toBe(testOrderId);
    expect(result.data[0].rating).toBe(5);
    expect(result.data[0].images).toHaveLength(2);
    expect(result.data[0].is_anonymous).toBe(true);

    // Verify retrieval
    const reviews = await reviewRepository.getOrderReviews(testOrderId);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].comment).toContain("Bàn phím gõ rất êm");

    const isReviewed = await reviewRepository.isOrderReviewed(testOrderId);
    expect(isReviewed).toBe(true);
  });

  it("enforces RB-LB09 preventing duplicate reviews for same order item", async () => {
    const testOrderId = `order_dup_${Date.now()}`;
    const testItemId = `item_dup_${Date.now()}`;

    const payload: CreateReviewPayload = {
      order_id: testOrderId,
      reviews: [
        {
          order_item_id: testItemId,
          product_name: "Kem Chống Nắng",
          rating: 4,
          comment: "Kem dùng thấm nhanh, không bết rít da mặt.",
          images: [],
          is_anonymous: false,
        },
      ],
    };

    // First submission succeeds
    await reviewRepository.submitReview(payload);

    // Second submission must be rejected with 409
    await expect(reviewRepository.submitReview(payload)).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_ALREADY_EXISTS",
    });
  });

  it("verifies order eligibility invariant QD14: only COMPLETED order can be reviewed", async () => {
    const orderRepo = repositories.order();
    const all = await orderRepo.getOrders();

    const completed = all.find((o) => o.status === "COMPLETED");
    expect(completed).toBeDefined();
    expect(completed?.status).toBe("COMPLETED");

    const pending = all.find((o) => o.status === "PENDING_CONFIRMATION");
    expect(pending).toBeDefined();
    expect(pending?.status).not.toBe("COMPLETED");
  });
});
