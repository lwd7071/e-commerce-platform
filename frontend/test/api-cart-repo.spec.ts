import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiCartRepository } from "@/features/cart/cart.repository";
import { apiClient } from "@/lib/api/client";
import { AppError } from "@/lib/api/app-error";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ApiCartRepository without silent mock fallbacks", () => {
  let repo: ApiCartRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ApiCartRepository();
  });

  it("Case 4.1: getCart throws AppError on 500 and does NOT fallback to mock items", async () => {
    const error500 = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Cart service error",
      requestId: "req_cart_500",
    });
    vi.mocked(apiClient.get).mockRejectedValue(error500);

    let thrownError: unknown;
    try {
      await repo.getCart();
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      code: "INTERNAL_ERROR",
      requestId: "req_cart_500",
    });
  });

  it("Case 4.2 (Regression Guard): getCart resolves [] faithfully when cart is empty", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      cart_id: "c1",
      buyer_id: "b1",
      items: [],
    });

    const items = await repo.getCart();
    expect(items).toEqual([]);
  });

  it("Case 4.3: updateItem throws AppError on 409 INVENTORY_INSUFFICIENT and does NOT silently swallow", async () => {
    const error409 = new AppError({
      status: 409,
      code: "INVENTORY_INSUFFICIENT",
      message: "Số lượng vượt quá tồn kho",
    });
    vi.mocked(apiClient.patch).mockRejectedValue(error409);

    let thrownError: unknown;
    try {
      await repo.updateItem("ci_01", { quantity: 5 });
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      code: "INVENTORY_INSUFFICIENT",
    });
  });

  it("Case 4.4: removeItem and removeSelected throw AppError on API errors", async () => {
    const error500 = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Delete failed",
    });
    vi.mocked(apiClient.delete).mockRejectedValue(error500);

    let thrownRemoveItem: unknown;
    try {
      await repo.removeItem("ci_01");
    } catch (e) {
      thrownRemoveItem = e;
    }
    expect(thrownRemoveItem).toBeInstanceOf(AppError);

    let thrownRemoveSelected: unknown;
    try {
      await repo.removeSelected();
    } catch (e) {
      thrownRemoveSelected = e;
    }
    expect(thrownRemoveSelected).toBeInstanceOf(AppError);
  });
});
