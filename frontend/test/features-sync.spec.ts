import { describe, it, expect, vi, afterEach } from "vitest";

describe("features & repository factory synchronization", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/config/env");
  });

  it("Case 1.1 (Red): when useMock is false, cartMock and checkoutMock are false and factories choose Api*Repository", async () => {
    vi.resetModules();
    vi.doMock("@/lib/config/env", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("@/lib/config/env");
      return {
        ...actual,
        envConfig: {
          ...(actual.envConfig as object),
          useMock: false,
        },
      };
    });

    const { features } = await import("@/lib/config/features");
    const { cartRepository, ApiCartRepository } = await import("@/features/cart/cart.repository");
    const { checkoutRepository, ApiCheckoutRepository } = await import("@/features/checkout/checkout.repository");

    expect(features.domains.cartMock()).toBe(false);
    expect(features.domains.checkoutMock()).toBe(false);
    expect(cartRepository).toBeInstanceOf(ApiCartRepository);
    expect(checkoutRepository).toBeInstanceOf(ApiCheckoutRepository);
  });

  it("Case 1.2 (Regression Guard): when useMock is true, cartMock and checkoutMock are true and factories choose Mock*Repository", async () => {
    vi.resetModules();
    vi.doMock("@/lib/config/env", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("@/lib/config/env");
      return {
        ...actual,
        envConfig: {
          ...(actual.envConfig as object),
          useMock: true,
        },
      };
    });

    const { features } = await import("@/lib/config/features");
    const { cartRepository, MockCartRepository } = await import("@/features/cart/cart.repository");
    const { checkoutRepository, MockCheckoutRepository } = await import("@/features/checkout/checkout.repository");

    expect(features.domains.cartMock()).toBe(true);
    expect(features.domains.checkoutMock()).toBe(true);
    expect(cartRepository).toBeInstanceOf(MockCartRepository);
    expect(checkoutRepository).toBeInstanceOf(MockCheckoutRepository);
  });
});
