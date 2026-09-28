import { describe, it, expect } from "vitest";
import { categoryAdapter, VERIFIED_CATEGORY_FIXTURES } from "@/lib/adapters/category.adapter";

describe("CategoryAdapter (A-700 / B-305 / RB-KN04 / GAP-05)", () => {
  it("only returns ACTIVE categories for catalog display", async () => {
    const categories = await categoryAdapter.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.status === "ACTIVE")).toBe(true);
  });

  it("builds a hierarchical tree conforming to max 2 levels (RB-KN04)", async () => {
    const tree = await categoryAdapter.getCategoryTree();
    expect(tree.length).toBeGreaterThan(0);
    for (const root of tree) {
      expect(root.parentId).toBeNull();
      for (const child of root.children) {
        expect(child.parentId).toBe(root.id);
      }
    }
  });

  it("verifies known category IDs safely", async () => {
    const validId = VERIFIED_CATEGORY_FIXTURES[0].id;
    expect(await categoryAdapter.isValidCategory(validId)).toBe(true);
    expect(await categoryAdapter.isValidCategory("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(await categoryAdapter.isValidCategory(null)).toBe(false);
    expect(await categoryAdapter.isValidCategory(undefined)).toBe(false);
  });
});
