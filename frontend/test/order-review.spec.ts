import { describe, it, expect } from "vitest";
import { validateReviewInput, isOrderEligibleForReview } from "../src/features/orders/order-review-validator";

describe("Order Review Validation (Người 5 - TDD)", () => {
  it("chỉ cho phép đánh giá đơn hàng khi trạng thái là COMPLETED", () => {
    expect(isOrderEligibleForReview("COMPLETED")).toBe(true);
    expect(isOrderEligibleForReview("PENDING_CONFIRMATION")).toBe(false);
    expect(isOrderEligibleForReview("SHIPPING")).toBe(false);
    expect(isOrderEligibleForReview("CANCELLED")).toBe(false);
  });

  it("chấp nhận đánh giá hợp lệ với rating 1 đến 5 sao", () => {
    const valid = {
      rating: 5,
      comment: "Chất lượng sản phẩm rất tốt, giao hàng nhanh.",
      media_urls: ["https://example.com/photo.jpg"],
    };
    const res = validateReviewInput(valid);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual({});
  });

  it("chặn khi chưa chọn số sao (rating = 0)", () => {
    const res = validateReviewInput({
      rating: 0,
      comment: "Tuyệt vời",
    });
    expect(res.valid).toBe(false);
    expect(res.errors.rating).toContain("số sao");
  });

  it("chặn khi số sao vượt quá 5 hoặc là số thập phân", () => {
    const resOver = validateReviewInput({ rating: 6, comment: "" });
    expect(resOver.valid).toBe(false);

    const resFloat = validateReviewInput({ rating: 4.5, comment: "" });
    expect(resFloat.valid).toBe(false);
  });
});
