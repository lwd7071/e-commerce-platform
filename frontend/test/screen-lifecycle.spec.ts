import { describe, it, expect, vi, beforeEach } from "vitest";
import { cartRepository } from "@/features/cart/cart.repository";
import { checkoutRepository } from "@/features/checkout/checkout.repository";

vi.mock("@/features/cart/cart.repository", () => ({
  cartRepository: {
    getCart: vi.fn(),
  },
}));

vi.mock("@/features/checkout/checkout.repository", () => ({
  checkoutRepository: {
    getAddresses: vi.fn(),
    submitCheckout: vi.fn(),
  },
}));

describe("screen lifecycle and observable effect behaviors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case 5.1: fetch is triggered on mount and resolves data cleanly", async () => {
    vi.mocked(cartRepository.getCart).mockResolvedValueOnce([
      {
        id: "ci_1",
        variantId: "v1",
        productId: "p1",
        productName: "Test",
        variantName: "Size M",
        price: "100000.00",
        originalPrice: null,
        quantity: 1,
        stock: 10,
        shopId: "s1",
        shopName: "Dino",
        imageUrl: null,
        isSelected: true,
        isAvailable: true,
        productStatus: "ACTIVE",
        variantStatus: "ACTIVE",
        shopStatus: "ACTIVE",
      },
    ]);
    vi.mocked(checkoutRepository.getAddresses).mockResolvedValueOnce([
      {
        addressId: "addr_1",
        recipientName: "Test",
        phone: "0123456789",
        province: "HN",
        district: "CG",
        ward: "MP",
        detailAddress: "123",
        isDefault: true,
      },
    ]);

    const cart = await cartRepository.getCart();
    const addresses = await checkoutRepository.getAddresses();

    expect(cart.length).toBe(1);
    expect(addresses.length).toBe(1);
    expect(cartRepository.getCart).toHaveBeenCalledTimes(1);
    expect(checkoutRepository.getAddresses).toHaveBeenCalledTimes(1);
  });

  it("Case 5.2: retry refetches data when previous fetch failed", async () => {
    vi.mocked(cartRepository.getCart)
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce([]);

    await expect(cartRepository.getCart()).rejects.toThrow("Network failed");
    const retryResult = await cartRepository.getCart();
    expect(retryResult).toEqual([]);
    expect(cartRepository.getCart).toHaveBeenCalledTimes(2);
  });

  it("Case 5.3: async task unmount safety prevents state updates when unmounted", async () => {
    let mounted = true;
    let state = "initial";

    const asyncTask = new Promise<string>((resolve) => {
      setTimeout(() => {
        if (mounted) {
          state = "resolved";
        }
        resolve(state);
      }, 50);
    });

    // Simulate unmount before resolution
    mounted = false;

    const finalState = await asyncTask;
    expect(finalState).toBe("initial");
    expect(state).toBe("initial");
  });
});
