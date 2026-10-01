// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReviewScreen } from "@/features/review/review-screen";
import { repositories } from "@/lib/repositories/repository-factory";
import { reviewRepository } from "@/features/review/review.repository";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/order-1/review",
}));

vi.mock("@/components/navigation/protected-page", () => ({
  ProtectedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/config/features", () => ({
  features: {
    useMock: () => false, // Live mode
  },
}));

describe("ReviewScreen Live Media UI & Submission", () => {
  const mockOrder = {
    id: "order-1",
    status: "COMPLETED" as const,
    created_at: "2026-10-01T00:00:00Z",
    total_amount: 100000,
    shipping_address: "123 Test St",
    payment_method: "COD" as const,
    items: [
      {
        id: "item-1",
        product_id: "prod-1",
        product_name: "Áo Thun Cao Cấp",
        price: 100000,
        quantity: 1,
        variant_name: "Size L",
        image_url: "/test-img.jpg",
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(repositories, "order").mockReturnValue({
      getOrderById: vi.fn().mockResolvedValue(mockOrder),
      listOrders: vi.fn(),
      cancelOrder: vi.fn(),
      confirmReceived: vi.fn(),
    } as any);

    vi.spyOn(reviewRepository, "getOrderReviews").mockResolvedValue([]);
  });

  it("renders ReviewMediaUpload in live mode instead of fallback notice", async () => {
    render(<ReviewScreen orderId="order-1" />);

    // Chờ order load xong
    await waitFor(() => {
      expect(screen.getByText("Áo Thun Cao Cấp")).toBeTruthy();
    });

    // Phải hiển thị phần tải ảnh
    expect(screen.getByText("Hình ảnh thực tế đính kèm")).toBeTruthy();
    expect(screen.getByText("Thêm ảnh")).toBeTruthy();

    // Không được còn câu thông báo bị disable
    expect(
      screen.queryByText(/Ảnh đánh giá sẽ khả dụng sau khi API lưu media/),
    ).toBeNull();
  });

  it("submits review with attached media_id and user comment", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/media/uploads/presign")) {
        return new Response(JSON.stringify({
          data: {
            media_id: "00000000-0000-4000-8000-000000000101",
            upload_url: "https://storage.test/signed-upload",
            storage_path: "users/buyer/reviews/draft/image.png",
            expires_in_seconds: 600,
          },
          request_id: "req_review_upload",
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url === "https://storage.test/signed-upload") {
        return new Response("OK", { status: 200 });
      }
      if (url.endsWith("/media/uploads/00000000-0000-4000-8000-000000000101/finalize")) {
        return new Response(JSON.stringify({
          data: {
            media_id: "00000000-0000-4000-8000-000000000101",
            public_url: "https://storage.test/review-photo.png",
            storage_path: "users/buyer/reviews/draft/image.png",
            status: "FINALIZED",
          },
          request_id: "req_review_finalize",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const submitSpy = vi.spyOn(reviewRepository, "submitReview").mockResolvedValue({
      success: true,
      message: "Thành công",
      data: [],
    });

    render(<ReviewScreen orderId="order-1" />);

    await waitFor(() => {
      expect(screen.getByText("Áo Thun Cao Cấp")).toBeTruthy();
    });

    // Nhập nhận xét hợp lệ (>= 10 ký tự)
    const textarea = screen.getByPlaceholderText(/Hãy chia sẻ cảm nhận về chất lượng/);
    await userEvent.type(textarea, "Sản phẩm dùng rất tốt và vải mịn đẹp!");

    // Tải ảnh lên
    const uploadInput = screen.getByLabelText("Thêm ảnh");
    await userEvent.upload(uploadInput, new File(["png"], "review.png", { type: "image/png" }));

    // Chờ ảnh render trong preview
    await waitFor(() => {
      expect(screen.getByAltText("Hình ảnh đánh giá 1")).toBeTruthy();
    });

    // Bấm nút gửi đánh giá
    const submitBtn = screen.getByRole("button", { name: "Gửi toàn bộ đánh giá" });
    await userEvent.click(submitBtn);

    // Kiểm tra submitReview được gọi
    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    const callArg = submitSpy.mock.calls[0]?.[0];
    expect(callArg.order_id).toBe("order-1");
    expect(callArg.reviews[0].comment).toBe("Sản phẩm dùng rất tốt và vải mịn đẹp!");
    expect(callArg.reviews[0].rating).toBe(5);
    expect(callArg.reviews[0].image_media_ids).toEqual(["00000000-0000-4000-8000-000000000101"]);
    expect(callArg.reviews[0].images).toEqual(["https://storage.test/review-photo.png"]);
  });
});
