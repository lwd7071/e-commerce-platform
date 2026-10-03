import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiAdminRepository } from "@/features/admin/admin.repository";

describe("Admin category API (RB-KN04)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads every category and preserves INACTIVE state from the admin endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ category_id: "cat-1", parent_category_id: null, category_name: "Đồ gia dụng", description: null, status: "INACTIVE" }],
      request_id: "req-test",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ApiAdminRepository().getCategories()).resolves.toEqual([
      { id: "cat-1", parentId: null, name: "Đồ gia dụng", description: null, status: "INACTIVE" },
    ]);
    expect(fetchMock.mock.calls[0][0]).toContain("/admin/categories");
  });

  it("creates, edits, and inactivates categories through admin routes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { category_id: "cat-1", parent_category_id: null, category_name: "Đồ nhà", description: null, status: "ACTIVE" } }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { category_id: "cat-1", parent_category_id: null, category_name: "Đồ gia dụng", description: "Mô tả", status: "ACTIVE" } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ category_id: "cat-1", parent_category_id: null, category_name: "Đồ gia dụng", description: "Mô tả", status: "ACTIVE" }] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { category_id: "cat-1", status: "INACTIVE" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const repository = new ApiAdminRepository();

    await repository.createCategory({ name: "Đồ nhà", parentId: null });
    await repository.updateCategory("cat-1", { name: "Đồ gia dụng", description: "Mô tả" });
    await repository.toggleCategoryStatus("cat-1");

    expect(fetchMock.mock.calls.map(([url, options]) => [String(url), options?.method])).toEqual(expect.arrayContaining([
      [expect.stringContaining("/admin/categories"), "POST"],
      [expect.stringContaining("/admin/categories/cat-1"), "PATCH"],
      [expect.stringContaining("/admin/categories"), "GET"],
      [expect.stringContaining("/admin/categories/cat-1/status"), "PATCH"],
    ]));
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({ status: "INACTIVE" });
  });

  it("reads real moderation rows without inventing report counts and sends moderation state to Admin", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ product_id: "product-1", product_name: "Ấm siêu tốc", shop_name: "Nhà bếp", min_price: "250000.00", status: "ACTIVE", created_at: "2026-09-01T00:00:00.000Z" }] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ product_id: "product-1", product_name: "Ấm siêu tốc", shop_name: "Nhà bếp", min_price: "250000.00", status: "ACTIVE", created_at: "2026-09-01T00:00:00.000Z" }] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { product_id: "product-1", status: "HIDDEN", updated_at: "2026-09-02T00:00:00.000Z" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const repository = new ApiAdminRepository();

    await expect(repository.getModerationProducts()).resolves.toEqual([
      { id: "product-1", name: "Ấm siêu tốc", shopName: "Nhà bếp", price: "250000.00", status: "ACTIVE" },
    ]);
    await expect(repository.moderateProduct("product-1", "HIDDEN", "Vi phạm chính sách")).resolves.toMatchObject({ id: "product-1", status: "HIDDEN" });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ status: "HIDDEN", reason: "Vi phạm chính sách" });
  });

  it("maps Review rows and posts a reasoned visibility command", async () => {
    const review = { review_id: "review-1", product_id: "product-1", product_name: "Ấm siêu tốc", buyer_id: "buyer-1", rating: 1, content: "Nội dung", status: "VISIBLE", created_at: "2026-09-01T00:00:00.000Z" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [review] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "HIDDEN" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const repository = new ApiAdminRepository();

    await expect(repository.getModerationReviews()).resolves.toMatchObject([{ id: "review-1", rating: 1, status: "VISIBLE" }]);
    await expect(repository.moderateReview("review-1", "HIDDEN", "Review vi phạm")).resolves.toMatchObject({ id: "review-1", status: "HIDDEN" });
    expect(fetchMock.mock.calls[1][0]).toContain("/admin/reviews/review-1/moderate");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ status: "HIDDEN", reason: "Review vi phạm" });
  });
});
