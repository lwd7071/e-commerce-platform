import { describe, it, expect } from "vitest";
import {
  validateStockQuantityInput,
  buildCatalogUrlSearchParams,
  createCatalogQueryCoordinator,
} from "@/features/catalog/catalog-query-engine";

describe("Catalog Query Engine & Validation (Production Code Under Test)", () => {
  describe("validateStockQuantityInput (O-509 strict integer validation)", () => {
    it("rejects decimal numbers and prevents silent float truncation (e.g., 1.5 -> 1)", () => {
      const result = validateStockQuantityInput("1.5");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("phải là số nguyên");
      expect(result.value).toBeUndefined();
    });

    it("rejects negative numbers", () => {
      const result = validateStockQuantityInput("-5");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("không được âm");
    });

    it("rejects empty or non-numeric inputs", () => {
      expect(validateStockQuantityInput("").valid).toBe(false);
      expect(validateStockQuantityInput("   ").valid).toBe(false);
      expect(validateStockQuantityInput("abc").valid).toBe(false);
    });

    it("accepts valid non-negative integer", () => {
      const result = validateStockQuantityInput("25");
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);

      const zeroResult = validateStockQuantityInput("0");
      expect(zeroResult.valid).toBe(true);
      expect(zeroResult.value).toBe(0);

      const paddedResult = validateStockQuantityInput("  100  ");
      expect(paddedResult.valid).toBe(true);
      expect(paddedResult.value).toBe(100);
    });
  });

  describe("buildCatalogUrlSearchParams (B-301 URL filter synchronization)", () => {
    it("omits empty filters and default sort to keep URL clean", () => {
      const params = buildCatalogUrlSearchParams({
        search: "",
        categoryId: "",
        sort: "created_at_desc",
        minPrice: "",
        maxPrice: "",
      });
      expect(params.toString()).toBe("");
    });

    it("includes active search, category, non-default sort, and price bounds", () => {
      const params = buildCatalogUrlSearchParams({
        search: "bàn phím",
        categoryId: "00000000-0000-0000-0000-000000000010",
        sort: "price_asc",
        minPrice: "100000",
        maxPrice: "500000",
      });

      expect(params.get("search")).toBe("bàn phím");
      expect(params.get("category_id")).toBe("00000000-0000-0000-0000-000000000010");
      expect(params.get("sort")).toBe("price_asc");
      expect(params.get("min_price")).toBe("100000");
      expect(params.get("max_price")).toBe("500000");
    });

    it("ignores non-numeric price filters", () => {
      const params = buildCatalogUrlSearchParams({
        search: "",
        categoryId: "",
        sort: "created_at_desc",
        minPrice: "abc",
        maxPrice: "xyz",
      });
      expect(params.get("min_price")).toBeNull();
      expect(params.get("max_price")).toBeNull();
    });
  });

  describe("createCatalogQueryCoordinator (Race condition guard)", () => {
    it("coordinates monotonic query sequences and rejects stale responses", async () => {
      const coordinator = createCatalogQueryCoordinator();
      let latestAppliedData: string | null = null;

      async function simulatedFetch(queryId: number, delayMs: number, resultData: string) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (coordinator.isLatest(queryId)) {
          latestAppliedData = resultData;
        }
      }

      // Query 1 starts (slow query, takes 50ms)
      const q1Id = coordinator.startQuery();
      const p1 = simulatedFetch(q1Id, 50, "Data from query 1");

      // Query 2 starts immediately (fast query, takes 10ms)
      const q2Id = coordinator.startQuery();
      const p2 = simulatedFetch(q2Id, 10, "Data from query 2");

      await Promise.all([p1, p2]);

      // Query 1 finished later than Query 2, but its result was discarded because q1Id !== coordinator.getActiveId()
      expect(latestAppliedData).toBe("Data from query 2");
    });
  });
});
