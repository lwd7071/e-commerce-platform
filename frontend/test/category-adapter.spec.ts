import { describe, it, expect, vi } from "vitest";
import { CategoryAdapterImpl, DEV_CATEGORY_FIXTURES } from "@/lib/adapters/category.adapter";
import { catalogApi } from "@/lib/api/catalog.api";

describe("CategoryAdapter (A-700 / B-305 / RB-KN04 / GAP-05)", () => {
  it("returns active categories in mock mode conforming to RB-KN04", async () => {
    const adapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, true);
    const categories = await adapter.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.status === "ACTIVE")).toBe(true);
  });

  it("builds a hierarchical tree conforming to max 2 levels (RB-KN04)", async () => {
    const adapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, true);
    const tree = await adapter.getCategoryTree();
    expect(tree.length).toBe(3);
    for (const root of tree) {
      expect(root.parentId).toBeNull();
      expect(root.children.length).toBeGreaterThan(0);
      for (const child of root.children) {
        expect(child.parentId).toBe(root.id);
      }
    }
  });

  it("loads and caches real category DTOs in live mode", async () => {
    const getCategories = vi.spyOn(catalogApi, "getCategories").mockResolvedValue([
      { category_id: "root", parent_category_id: null, category_name: "Thời trang", description: null },
      { category_id: "child", parent_category_id: "root", category_name: "Áo", description: "Trang phục" },
    ]);
    const liveAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, false);
    const categories = await liveAdapter.getCategories();
    expect(categories.map(category => category.id)).toEqual(["root", "child"]);
    expect(await liveAdapter.isValidCategory("child")).toBe(true);
    expect(getCategories).toHaveBeenCalledTimes(1);
    getCategories.mockRestore();
  });

  it("verifies known category IDs safely in mock mode and rejects unknown/null in live mode", async () => {
    const mockAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, true);
    const validId = DEV_CATEGORY_FIXTURES[0].id;
    expect(await mockAdapter.isValidCategory(validId)).toBe(true);
    expect(await mockAdapter.isValidCategory("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(await mockAdapter.isValidCategory(null)).toBe(false);
    expect(await mockAdapter.isValidCategory(undefined)).toBe(false);

    const liveAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, false);
    vi.spyOn(catalogApi, "getCategories").mockResolvedValue([]);
    expect(await liveAdapter.isValidCategory(validId)).toBe(false);
    vi.restoreAllMocks();
  });
});
