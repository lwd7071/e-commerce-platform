import { describe, it, expect, vi, beforeEach } from "vitest";
import { buyerApi } from "@/lib/api/buyer.api";
import { voucherApi } from "@/lib/api/voucher.api";
import { apiClient } from "@/lib/api/client";
import { repositories } from "@/lib/repositories/repository-factory";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Buyer & Voucher Adapters (Plan v3.2 Specification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. Address Domain Tests
  // ==========================================
  describe("Address API & DTOs (camelCase /addresses)", () => {
    it("1.1: getAddresses calls GET /addresses and returns camelCase WireAddress[]", async () => {
      const mockAddresses = [
        {
          addressId: "addr_001",
          userId: "user_001",
          recipientName: "Nguyễn Văn A",
          phone: "0901234567",
          province: "Thành phố Hồ Chí Minh",
          district: "Quận 1",
          ward: "Phường Bến Nghé",
          detailAddress: "123 Đường Lê Lợi",
          isDefault: true,
          createdAt: "2026-09-29T00:00:00.000Z",
          updatedAt: "2026-09-29T00:00:00.000Z",
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockAddresses);

      const result = await buyerApi.getAddresses();
      expect(apiClient.get).toHaveBeenCalledWith("/addresses");
      expect(result).toEqual(mockAddresses);
      expect(result[0].addressId).toBe("addr_001");
      expect(result[0].recipientName).toBe("Nguyễn Văn A");
    });

    it("1.2: createAddress calls POST /addresses with camelCase CreateAddressPayload", async () => {
      const payload = {
        recipientName: "Trần Thị B",
        phone: "0912345678",
        province: "Hà Nội",
        district: "Cầu Giấy",
        ward: "Dịch Vọng",
        detailAddress: "456 Đường Cầu Giấy",
        isDefault: false,
      };
      const createdAddress = {
        addressId: "addr_002",
        ...payload,
        createdAt: "2026-09-29T00:00:00.000Z",
        updatedAt: "2026-09-29T00:00:00.000Z",
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce(createdAddress);

      const result = await buyerApi.createAddress(payload);
      expect(apiClient.post).toHaveBeenCalledWith("/addresses", payload);
      expect(result.addressId).toBe("addr_002");
      expect(result.recipientName).toBe("Trần Thị B");
    });
  });

  // ==========================================
  // 2. Voucher Domain Tests
  // ==========================================
  describe("Voucher API & DTOs (camelCase /vouchers/applicable & union evaluate)", () => {
    it("2.1: getVouchers calls GET /vouchers/applicable with query params", async () => {
      const mockVouchers = [
        {
          voucherId: "vouch_001",
          code: "DINO50K",
          voucherName: "Ưu đãi Dino 50k",
          scope: "PLATFORM" as const,
          shopId: null,
          discountType: "FIXED" as const,
          discountValue: "50000.00",
          maxDiscount: null,
          minOrderValue: "200000.00",
          quantity: 50,
          startAt: "2026-01-01T00:00:00.000Z",
          endAt: "2026-12-31T23:59:59.000Z",
          status: "ACTIVE" as const,
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockVouchers);

      const result = await voucherApi.getVouchers({ shop_id: "shop_01" });
      expect(apiClient.get).toHaveBeenCalledWith("/vouchers/applicable", {
        params: { shop_id: "shop_01" },
      });
      expect(result).toEqual(mockVouchers);
      expect(result[0].voucherId).toBe("vouch_001");
    });

    it("2.2: evaluateVoucher handles valid result discriminated union", async () => {
      const validResponse = {
        isValid: true as const,
        voucherId: "vouch_001",
        discountAmount: "50000.00",
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce(validResponse);

      const result = await voucherApi.evaluateVoucher({
        code: "DINO50K",
        order_subtotal: "250000.00",
        shop_id: "shop_01",
      });
      expect(apiClient.post).toHaveBeenCalledWith("/vouchers/evaluate", {
        code: "DINO50K",
        order_subtotal: "250000.00",
        shop_id: "shop_01",
      });
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.discountAmount).toBe("50000.00");
      }
    });

    it("2.3: evaluateVoucher handles invalid result discriminated union", async () => {
      const invalidResponse = {
        isValid: false as const,
        errorCode: "MIN_ORDER_VALUE_NOT_MET",
        errorMessage: "Đơn hàng tối thiểu để áp dụng mã là 200.000₫.",
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce(invalidResponse);

      const result = await voucherApi.evaluateVoucher({
        code: "DINO50K",
        order_subtotal: "150000.00",
      });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errorCode).toBe("MIN_ORDER_VALUE_NOT_MET");
      }
    });
  });

  // ==========================================
  // 3. Cart Domain Write-Ops Tests
  // ==========================================
  describe("Cart Write-Ops Invariants & Strict Whitelist", () => {
    it("3.1: getCart calls GET /cart and returns WireCart", async () => {
      const mockCart = {
        cart_id: "cart_01",
        buyer_id: "user_001",
        items: [
          {
            cart_item_id: "ci_01",
            variant_id: "var_01",
            quantity: 2,
            is_selected: true,
          },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockCart);

      const result = await buyerApi.getCart();
      expect(apiClient.get).toHaveBeenCalledWith("/cart");
      expect(result.items[0].cart_item_id).toBe("ci_01");
    });

    it("3.2: addToCart strictly sends { variant_id, quantity } without is_selected and returns single item", async () => {
      const mockItemResponse = {
        cart_item_id: "ci_02",
        variant_id: "var_02",
        quantity: 1,
        is_selected: false,
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockItemResponse);

      const result = await buyerApi.addToCart({
        variant_id: "00000000-0000-0000-0000-000000000201",
        quantity: 1,
      });

      expect(apiClient.post).toHaveBeenCalledWith("/cart/items", {
        variant_id: "00000000-0000-0000-0000-000000000201",
        quantity: 1,
      });
      expect(result).toEqual(mockItemResponse);
      // Ensure payload passed to post does NOT contain is_selected
      const calledPayload = vi.mocked(apiClient.post).mock.calls[0][1];
      expect(calledPayload).not.toHaveProperty("is_selected");
    });

    it("3.3a: updateCartItem calls PATCH /cart/items/:id and returns updated single item", async () => {
      const mockUpdated = {
        cart_item_id: "ci_02",
        variant_id: "var_02",
        quantity: 3,
        is_selected: true,
      };
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockUpdated);

      const result = await buyerApi.updateCartItem("ci_02", {
        quantity: 3,
        is_selected: true,
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/cart/items/ci_02", {
        quantity: 3,
        is_selected: true,
      });
      expect(result).toEqual(mockUpdated);
    });

    it("3.3b: updateCartItem client guard rejects via Promise.reject when quantity < 1", async () => {
      await expect(buyerApi.updateCartItem("ci_02", { quantity: 0 })).rejects.toThrow(
        "Số lượng sản phẩm trong giỏ phải >= 1"
      );
      expect(apiClient.patch).not.toHaveBeenCalled();
    });

    it("3.4: removeCartItem calls DELETE /cart/items/:id and resolves without json parsing crash", async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await expect(buyerApi.removeCartItem("ci_02")).resolves.toBeUndefined();
      expect(apiClient.delete).toHaveBeenCalledWith("/cart/items/ci_02");
    });

    it("3.5: removeSelectedCartItems calls DELETE /cart/selected and resolves without json parsing crash", async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await expect(buyerApi.removeSelectedCartItems()).resolves.toBeUndefined();
      expect(apiClient.delete).toHaveBeenCalledWith("/cart/selected");
    });
  });

  // ==========================================
  // 4. Live Profile API
  // ==========================================
  describe("Profile API", () => {
    it("4.1: getProfile reads the authenticated profile endpoint", async () => {
      const profile = { user_id: "u1", full_name: "Test User", phone: null, avatar_url: null, updated_at: "2026-09-29T00:00:00Z" };
      vi.mocked(apiClient.get).mockResolvedValueOnce(profile);
      await expect(buyerApi.getProfile()).resolves.toEqual(profile);
      expect(apiClient.get).toHaveBeenCalledWith("/profile");
    });

    it("4.2: updateProfile writes only editable profile fields", async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce({});
      await buyerApi.updateProfile({ full_name: "Test", phone: "0901234567" });
      expect(apiClient.patch).toHaveBeenCalledWith("/profile", { full_name: "Test", phone: "0901234567" });
    });
  });

  // ==========================================
  // 5. Central Factory Alignment Tests
  // ==========================================
  describe("Central Repository Factory live bindings", () => {
    it("5.1: repositories.buyer() delegates correctly to buyerApi", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);
      const buyerRepo = repositories.buyer();
      await buyerRepo.getAddresses();
      expect(apiClient.get).toHaveBeenCalledWith("/addresses");
    });

    it("5.2: repositories.voucher() delegates correctly to voucherApi", async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);
      const voucherRepo = repositories.voucher();
      await voucherRepo.getVouchers("shop_01");
      expect(apiClient.get).toHaveBeenCalledWith("/vouchers/applicable", {
        params: { shop_id: "shop_01" },
      });
    });
  });
});
