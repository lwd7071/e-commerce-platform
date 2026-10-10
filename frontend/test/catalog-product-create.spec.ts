import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockCatalogRepository } from "@/lib/repositories/repository-factory";
import { catalogApi } from "@/lib/api/catalog.api";
import { validateStockQuantityInput } from "@/features/catalog/catalog-query-engine";

describe("Seller Product Creation & Stock Update (POST /products & PATCH /product-variants/:variant_id/stock)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("validates that all variants must have non-negative integer stock (QD06)", () => {
    expect(validateStockQuantityInput("10").valid).toBe(true);
    expect(validateStockQuantityInput("0").valid).toBe(true);
    expect(validateStockQuantityInput("-1").valid).toBe(false);
    expect(validateStockQuantityInput("2.5").valid).toBe(false);
    expect(validateStockQuantityInput("abc").valid).toBe(false);
  });

  it("creates a product in mock repository, reflecting in getSellerProducts", async () => {
    const created = await mockCatalogRepository.createProduct!({
      category_id: "00000000-0000-0000-0000-000000000010",
      product_name: "Kem Dưỡng Phục Hồi Da Ban Đêm",
      description: "Chiết xuất rau má phục hồi làn da nhạy cảm",
      images: [
        {
          image_url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800",
          sort_order: 0,
        },
      ],
      variants: [
        {
          variant_name: "Dung tích",
          variant_value: "Hũ 50g",
          sku: "CREAM-50G-TEST",
          price: "320000.00",
          stock_quantity: 40,
        },
      ],
    });

    expect(created.product_id).toBeDefined();
    expect(created.product_name).toBe("Kem Dưỡng Phục Hồi Da Ban Đêm");
    expect(created.variants).toHaveLength(1);
    expect(created.variants[0].sku).toBe("CREAM-50G-TEST");
    expect(created.variants[0].stock_quantity).toBe(40);

    // Verify it appears in seller products
    const sellerProds = await mockCatalogRepository.getSellerProducts();
    const found = sellerProds.find((p) => p.product_id === created.product_id);
    expect(found).toBeDefined();
    expect(found?.product_name).toBe("Kem Dưỡng Phục Hồi Da Ban Đêm");
    expect(found?.total_stock).toBe(40);
  });

  it("updates variant stock in mock repository and synchronizes total_stock", async () => {
    const created = await mockCatalogRepository.createProduct!({
      category_id: "00000000-0000-0000-0000-000000000011",
      product_name: "Áo Polo Nam Classic",
      description: "Chất liệu cotton thoáng mát",
      variants: [
        {
          variant_name: "Kích cỡ",
          variant_value: "Size L",
          sku: "POLO-L-01",
          price: "199000.00",
          stock_quantity: 20,
        },
      ],
    });

    const variantId = created.variants[0].variant_id;
    await mockCatalogRepository.updateStock!(variantId, 95);

    // Verify detail reflects new stock
    const detail = await mockCatalogRepository.getProductById(created.product_id);
    const updatedVariant = detail.variants.find((v) => v.variant_id === variantId);
    expect(updatedVariant?.stock_quantity).toBe(95);

    // Verify seller product list reflects new total stock
    const sellerProds = await mockCatalogRepository.getSellerProducts();
    const found = sellerProds.find((p) => p.product_id === created.product_id);
    expect(found?.total_stock).toBe(95);
  });

  it("dispatches POST /products with correct payload contract via catalogApi.createProduct", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          data: {
            product_id: "prod-new-001",
            shop_id: "shop-001",
            category_id: "00000000-0000-0000-0000-000000000010",
            product_name: "Serum Trị Mụn",
            description: "Mô tả",
            status: "ACTIVE",
            variants: [
              {
                variant_id: "var-001",
                variant_name: "Tiêu chuẩn",
                variant_value: null,
                sku: "SERUM-MUN-01",
                price: "150000.00",
                stock_quantity: 50,
                status: "ACTIVE",
              },
            ],
          },
          request_id: "req_create_01",
        }),
      };
    });

    const res = await catalogApi.createProduct({
      category_id: "00000000-0000-0000-0000-000000000010",
      product_name: "Serum Trị Mụn",
      description: "Mô tả",
      variants: [
        {
          variant_name: "Tiêu chuẩn",
          sku: "SERUM-MUN-01",
          price: "150000.00",
          stock_quantity: 50,
        },
      ],
    });

    expect(capturedUrl).toContain("/products");
    expect(capturedBody).toEqual({
      category_id: "00000000-0000-0000-0000-000000000010",
      product_name: "Serum Trị Mụn",
      description: "Mô tả",
      variants: [
        {
          variant_name: "Tiêu chuẩn",
          sku: "SERUM-MUN-01",
          price: "150000.00",
          stock_quantity: 50,
        },
      ],
    });
    expect(res.product_id).toBe("prod-new-001");
  });

  it("dispatches PATCH /product-variants/:id/stock with quantity via catalogApi.updateVariantStock", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;
    let capturedMethod = "";

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          data: {
            variant_id: "var-123",
            stock_quantity: 80,
          },
          request_id: "req_stock_01",
        }),
      };
    });

    const res = await catalogApi.updateVariantStock("var-123", 80);

    expect(capturedMethod).toBe("PATCH");
    expect(capturedUrl).toContain("/product-variants/var-123/stock");
    expect(capturedBody).toEqual({ quantity: 80 });
    expect(res.variant_id).toBe("var-123");
    expect(res.stock_quantity).toBe(80);
  });
});
