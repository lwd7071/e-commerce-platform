// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { getQueryClient, clearAppQueryCache } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";

function DummyConsumer({ id, fetcher }: { id: string; fetcher: () => Promise<string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["test", id],
    queryFn: fetcher,
  });

  if (isLoading) return <div>Loading test data...</div>;
  return <div data-testid="result">{data}</div>;
}

describe("TanStack Query Setup & Cache Architecture (Phase 1)", () => {
  beforeEach(() => {
    clearAppQueryCache();
  });

  it("should configure queryKeys hierarchically", () => {
    expect(queryKeys.profile.all).toEqual(["profile"]);
    expect(queryKeys.profile.details("buyer-1")).toEqual(["profile", "buyer-1", "details"]);
    expect(queryKeys.profile.loyalty("buyer-1")).toEqual(["profile", "buyer-1", "loyalty"]);
    expect(queryKeys.profile.addresses("buyer-1")).toEqual(["profile", "buyer-1", "addresses"]);
    expect(queryKeys.orders.list("buyer-1", "PROCESSING")).toEqual(["orders", "buyer-1", "list", "PROCESSING"]);
    expect(queryKeys.cart.all).toEqual(["cart"]);
    expect(queryKeys.cart.items("buyer-1")).toEqual(["cart", "buyer-1", "items"]);
    expect(queryKeys.seller.products("seller-1", { page: 1 })).toEqual(["seller", "seller-1", "products", { page: 1 }]);
  });

  it("should provide working query cache across components and reuse cached data", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return `payload_${callCount}`;
    };

    const { unmount } = render(
      <QueryProvider>
        <DummyConsumer id="item-1" fetcher={fetcher} />
      </QueryProvider>
    );

    // Lần 1: Chưa có cache -> fetcher được gọi
    await waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe("payload_1");
    });
    expect(callCount).toBe(1);

    // Unmount giả lập chuyển sang trang khác
    unmount();

    // Lần 2: Mount lại cùng key -> Dùng lại data trong RAM cache, không tăng callCount
    render(
      <QueryProvider>
        <DummyConsumer id="item-1" fetcher={fetcher} />
      </QueryProvider>
    );

    expect(screen.getByTestId("result").textContent).toBe("payload_1");
    expect(callCount).toBe(1);
  });

  it("should wipe cache when clearAppQueryCache is invoked", async () => {
    const client = getQueryClient();
    client.setQueryData(["user", "secret"], { name: "Alice" });

    expect(client.getQueryData(["user", "secret"])).toEqual({ name: "Alice" });

    clearAppQueryCache();

    expect(client.getQueryData(["user", "secret"])).toBeUndefined();
  });
});
