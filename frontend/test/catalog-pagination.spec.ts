import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { catalogApi } from "@/lib/api/catalog.api";

describe("Catalog Cursor Pagination (B-301 & Contract Hardening)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches page 1 and receives opaque cursor with has_more=true", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: [
          {
            product_id: "00000000-0000-0000-0000-000000000101",
            product_name: "Serum A",
            shop_id: "shop_1",
            category_id: "cat_1",
            min_price: "100000.00",
            max_price: "100000.00",
            total_stock: 10,
            image_url: null,
            created_at: new Date().toISOString(),
          },
          {
            product_id: "00000000-0000-0000-0000-000000000102",
            product_name: "Serum B",
            shop_id: "shop_1",
            category_id: "cat_1",
            min_price: "120000.00",
            max_price: "120000.00",
            total_stock: 15,
            image_url: null,
            created_at: new Date().toISOString(),
          },
        ],
        meta: {
          limit: 2,
          has_more: true,
          next_cursor: "eyJ2IjoxLCJvZmZzZXQiOjJ9", // Base64URL opaque cursor {"v":1,"offset":2}
        },
        request_id: "req_p1",
      }),
    });

    const page1 = await catalogApi.getProductsPaginated({ limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.has_more).toBe(true);
    expect(page1.meta.next_cursor).toBe("eyJ2IjoxLCJvZmZzZXQiOjJ9");
  });

  it("fetches page 2 using backend next_cursor and passes cursor parameter in request", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      capturedUrl = String(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          data: [
            {
              product_id: "00000000-0000-0000-0000-000000000103",
              product_name: "Kem C",
              shop_id: "shop_1",
              category_id: "cat_1",
              min_price: "200000.00",
              max_price: "200000.00",
              total_stock: 5,
              image_url: null,
              created_at: new Date().toISOString(),
            },
          ],
          meta: {
            limit: 2,
            has_more: false,
            next_cursor: null,
          },
          request_id: "req_p2",
        }),
      });
    });

    const nextCursor = "eyJ2IjoxLCJvZmZzZXQiOjJ9";
    const page2 = await catalogApi.getProductsPaginated({
      limit: 2,
      cursor: nextCursor,
    });

    expect(page2.data).toHaveLength(1);
    expect(page2.meta.has_more).toBe(false);
    expect(page2.meta.next_cursor).toBeNull();
    expect(capturedUrl).toContain(`cursor=${encodeURIComponent(nextCursor)}`);
  });
});
