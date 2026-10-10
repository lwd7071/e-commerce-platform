import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../src/lib/api/client";
import { ApiReviewRepository } from "../src/features/review/review.repository";
import { apiReviewRepository as liveReview } from "../src/lib/repositories/repository-factory";

describe("live review API", () => {
  it("submits one backend-compatible request per order item", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      reviewId: "review-1",
      orderItemId: "item-1",
      rating: 5,
      content: "Sản phẩm đúng mô tả",
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    const repository = new ApiReviewRepository();
    await repository.submitReview({
      order_id: "order-1",
      reviews: [{
        order_item_id: "item-1",
        product_id: "product-1",
        product_name: "Sản phẩm",
        rating: 5,
        comment: "Sản phẩm đúng mô tả",
        images: [],
        is_anonymous: false,
      }],
    });

    expect(post).toHaveBeenCalledWith("/order-items/item-1/review", {
      product_id: "product-1",
      rating: 5,
      content: "Sản phẩm đúng mô tả",
    });
    post.mockRestore();
  });

  it("maps the per-item form to the backend DTO", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      reviewId: "review-2", orderItemId: "item-2", rating: 4,
      content: "Đúng như mô tả", createdAt: "2026-10-01T00:00:00.000Z",
    });
    await liveReview.createReview({
      order_id: "order-1", order_item_id: "item-2", rating: 4,
      product_id: "product-2", comment: "Đúng như mô tả",
    });
    expect(post).toHaveBeenCalledWith("/order-items/item-2/review", {
      product_id: "product-2", rating: 4, content: "Đúng như mô tả",
    });
    post.mockRestore();
  });
});
