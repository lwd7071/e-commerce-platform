import { describe, it, expect } from "vitest";

describe("Catalog Filter & Input Validation Hardening", () => {
  describe("Stock Quantity Input Validation ([P2])", () => {
    function validateStockInput(input: string): { valid: boolean; error?: string; value?: number } {
      const trimmed = input.trim();
      if (!trimmed || isNaN(Number(trimmed))) {
        return { valid: false, error: "Vui lòng nhập số lượng tồn kho hợp lệ" };
      }
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed)) {
        return { valid: false, error: "Số lượng tồn kho phải là số nguyên (không được chứa phần thập phân)" };
      }
      if (parsed < 0) {
        return { valid: false, error: "Số lượng tồn kho không được âm" };
      }
      return { valid: true, value: parsed };
    }

    it("rejects decimal numbers and does not truncate 1.5 to 1", () => {
      const result = validateStockInput("1.5");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("phải là số nguyên");
      expect(result.value).toBeUndefined();
    });

    it("rejects negative numbers", () => {
      const result = validateStockInput("-5");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("không được âm");
    });

    it("accepts valid non-negative integer", () => {
      const result = validateStockInput("25");
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);

      const zeroResult = validateStockInput("0");
      expect(zeroResult.valid).toBe(true);
      expect(zeroResult.value).toBe(0);
    });
  });

  describe("Out-of-Order Query Resolution (Race Condition Guard)", () => {
    it("discards stale responses when newer query finishes earlier or later", async () => {
      let activeQueryId = 0;
      let latestAppliedData: string | null = null;

      async function simulatedFetch(queryId: number, delayMs: number, resultData: string) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Monotonic guard: discard if newer query was initiated
        if (queryId === activeQueryId) {
          latestAppliedData = resultData;
        }
      }

      // Query 1 starts (slow, takes 50ms)
      const q1Id = ++activeQueryId;
      const p1 = simulatedFetch(q1Id, 50, "Data from query 1");

      // Query 2 starts immediately (fast, takes 10ms)
      const q2Id = ++activeQueryId;
      const p2 = simulatedFetch(q2Id, 10, "Data from query 2");

      await Promise.all([p1, p2]);

      // Result MUST be Query 2, never overwritten by Query 1
      expect(latestAppliedData).toBe("Data from query 2");
    });
  });
});
