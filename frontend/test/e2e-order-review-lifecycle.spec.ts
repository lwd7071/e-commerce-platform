import { describe, it, expect, beforeAll, vi } from "vitest";
import type { IOrderRepository } from "../src/lib/repositories/types";
import type { ICheckoutRepository } from "../src/features/checkout/checkout.repository";
import type { IReviewRepository } from "../src/features/review/review.repository";
import { isOrderEligibleForReview } from "../src/features/orders/order-review-validator";

describe("E2E Critical Chain: Checkout -> Seller Fulfillment -> Buyer Confirm-Received -> Review (Người 5 E2E)", () => {
  let orderRepo: IOrderRepository;
  let checkoutRepo: ICheckoutRepository;
  let reviewRepo: IReviewRepository;

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "true");
    vi.resetModules();
    const { repositories } = await import("../src/lib/repositories/repository-factory");
    const { checkoutRepository } = await import("../src/features/checkout/checkout.repository");
    const { reviewRepository } = await import("../src/features/review/review.repository");

    orderRepo = repositories.order();
    checkoutRepo = checkoutRepository;
    reviewRepo = reviewRepository;
  });

  it("thực thi trọn vẹn vòng đời: Đặt hàng -> Seller duyệt & giao -> Buyer nhận hàng -> Viết review", async () => {
    // -------------------------------------------------------------
    // Bước 1: Buyer Checkout (Tạo đơn hàng mới)
    // -------------------------------------------------------------
    const idempotencyKey = `e2e-idemp-${Date.now()}`;
    const checkoutResult = await checkoutRepo.submitCheckout(
      {
        address_id: "addr_01",
        payment_method: "COD",
        vouchers: [],
      },
      idempotencyKey
    );

    expect(checkoutResult.orders.length).toBeGreaterThan(0);
    const orderId = checkoutResult.orders[0].order_id;
    expect(orderId).toBeDefined();

    // Kiểm tra đơn hàng lập tức xuất hiện trong Order Center của Buyer
    let buyerOrder = await orderRepo.getOrderById(orderId);
    expect(buyerOrder.id).toBe(orderId);
    expect(buyerOrder.status).toBe("PENDING_CONFIRMATION");

    // Lúc này đơn hàng CHƯA đủ điều kiện viết Review (QD14)
    expect(isOrderEligibleForReview(buyerOrder.status)).toBe(false);

    // -------------------------------------------------------------
    // Bước 2: Seller xử lý đơn hàng theo luồng tuần tự (Sequential Fulfillment)
    // -------------------------------------------------------------
    // 2.1: Seller xác nhận đơn (PENDING_CONFIRMATION -> CONFIRMED)
    const confirmedOrder = await orderRepo.confirmOrder(orderId, "Gian hàng xác nhận đơn");
    expect(confirmedOrder.status).toBe("CONFIRMED");

    // 2.2: Seller chuẩn bị hàng (CONFIRMED -> PREPARING)
    const preparingOrder = await orderRepo.transitionOrder(orderId, "PREPARING");
    expect(preparingOrder.status).toBe("PREPARING");

    // 2.3: Seller giao cho đơn vị vận chuyển (PREPARING -> SHIPPING)
    const shippingOrder = await orderRepo.transitionOrder(orderId, "SHIPPING");
    expect(shippingOrder.status).toBe("SHIPPING");

    // 2.4: Quy tắc QD11: Seller KHÔNG ĐƯỢC tự ý chuyển sang COMPLETED
    await expect(orderRepo.transitionOrder(orderId, "COMPLETED")).rejects.toThrow();

    // -------------------------------------------------------------
    // Bước 3: Buyer bấm "Đã nhận được hàng" (SHIPPING -> COMPLETED)
    // -------------------------------------------------------------
    const completedOrder = await orderRepo.confirmReceived!(orderId);
    expect(completedOrder.id).toBe(orderId);
    expect(completedOrder.status).toBe("COMPLETED");

    // Kiểm tra lại trạng thái lưu trữ của đơn hàng
    buyerOrder = await orderRepo.getOrderById(orderId);
    expect(buyerOrder.status).toBe("COMPLETED");

    // Đơn hàng ĐÃ ĐỦ điều kiện viết Review (QD14)
    expect(isOrderEligibleForReview(buyerOrder.status)).toBe(true);

    // -------------------------------------------------------------
    // Bước 4: Buyer gửi biểu mẫu đánh giá Review (O-507 & P-607c)
    // -------------------------------------------------------------
    const reviewPayload = {
      order_id: orderId,
      reviews: [
        {
          order_item_id: buyerOrder.items?.[0]?.id || `item_e2e_${Date.now()}`,
          product_name: buyerOrder.items?.[0]?.product_name || "Sản phẩm E2E Test",
          rating: 5,
          comment: "Sản phẩm dùng rất ưng ý, đóng gói đẹp và giao hàng cực nhanh!",
          images: ["https://example.com/review_photo1.webp"],
          is_anonymous: true,
        },
      ],
    };

    const reviewResult = await reviewRepo.submitReview(reviewPayload);
    expect(reviewResult.success).toBe(true);
    expect(reviewResult.data).toHaveLength(1);
    expect(reviewResult.data[0].rating).toBe(5);
    expect(reviewResult.data[0].order_id).toBe(orderId);

    // Kiểm tra truy vấn danh sách review đã lưu của đơn
    const storedReviews = await reviewRepo.getOrderReviews(orderId);
    expect(storedReviews).toHaveLength(1);
    expect(storedReviews[0].comment).toContain("Sản phẩm dùng rất ưng ý");

    // Xác nhận cờ đã review (isOrderReviewed)
    const isReviewed = await reviewRepo.isOrderReviewed(orderId);
    expect(isReviewed).toBe(true);

    // -------------------------------------------------------------
    // Bước 5: Chống đánh giá trùng lặp (RB-LB09)
    // -------------------------------------------------------------
    await expect(reviewRepo.submitReview(reviewPayload)).rejects.toMatchObject({
      status: 409,
      code: "REVIEW_ALREADY_EXISTS",
    });
  });
});
