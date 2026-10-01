import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogApi } from "@/lib/api/catalog.api";
import { CategoryAdapterImpl } from "@/lib/adapters/category.adapter";

vi.mock("@/lib/api/catalog.api", () => ({
  catalogApi: { getCategories: vi.fn() },
}));

describe("CategoryAdapter live boundary", () => {
  const adapter = new CategoryAdapterImpl(undefined, false);

  beforeEach(() => vi.clearAllMocks());

  it("returns only API categories in live mode", async () => {
    vi.mocked(catalogApi.getCategories).mockResolvedValue([
      {
        category_id: "cat-live-1",
        parent_category_id: null,
        category_name: "Danh mục thật",
        description: null,
      },
    ]);

    await expect(adapter.getCategories()).resolves.toEqual([
      {
        id: "cat-live-1",
        parentId: null,
        name: "Danh mục thật",
        description: null,
        status: "ACTIVE",
      },
    ]);
  });

  it("propagates live API failure instead of substituting development fixtures", async () => {
    const apiError = new Error("Category service unavailable");
    vi.mocked(catalogApi.getCategories).mockRejectedValue(apiError);

    await expect(adapter.getCategories()).rejects.toBe(apiError);
  });
});
