import { describe, it, expect } from "vitest";
import { CategoryAdapterImpl, DEV_CATEGORY_FIXTURES } from "@/lib/adapters/category.adapter";

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

  it("returns empty list in live mode when categories API/seed is unverified (GAP-05 safe hide)", async () => {
    const liveAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, false);
    const categories = await liveAdapter.getCategories();
    expect(categories).toEqual([]);
  });

  it("verifies known category IDs safely in mock mode and rejects unknown/null in live mode", async () => {
    const mockAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, true);
    const validId = DEV_CATEGORY_FIXTURES[0].id;
    expect(await mockAdapter.isValidCategory(validId)).toBe(true);
    expect(await mockAdapter.isValidCategory("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(await mockAdapter.isValidCategory(null)).toBe(false);
    expect(await mockAdapter.isValidCategory(undefined)).toBe(false);

    const liveAdapter = new CategoryAdapterImpl(DEV_CATEGORY_FIXTURES, false);
    expect(await liveAdapter.isValidCategory(validId)).toBe(false);
  });
});
