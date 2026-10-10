import { describe, expect, it, vi } from "vitest";
import { markNotificationsReadBounded } from "../src/features/notifications/notification-repository";

describe("markNotificationsReadBounded", () => {
  it("limits work to 20 visible IDs and runs at most four writes at once", async () => {
    let active = 0;
    let peak = 0;
    const write = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    });

    const result = await markNotificationsReadBounded(Array.from({ length: 30 }, (_, index) => `${index}`), write);
    expect(result.succeeded).toHaveLength(20);
    expect(result.failed).toEqual([]);
    expect(write).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("preserves per-item failures and stops queuing after a 429", async () => {
    const write = vi.fn(async (id: string) => {
      if (id === "2") throw Object.assign(new Error("rate limited"), { status: 429 });
      if (id === "1") throw new Error("one failed");
    });
    const result = await markNotificationsReadBounded(["1", "2", "3", "4"], write, 1);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual(["1", "2"]);
    expect(result.notAttempted).toEqual(["3", "4"]);
    expect(result.stoppedByRateLimit).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
