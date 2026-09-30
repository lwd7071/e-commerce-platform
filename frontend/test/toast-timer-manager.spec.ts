import { describe, expect, it, vi } from "vitest";
import { createToastTimerManager } from "@/components/ui/toast-timer-manager";

describe("Toast timer manager", () => {
  it("clears pending toast timers when dismissed or provider is disposed", () => {
    const timers = new Map<number, () => void>();
    const clearTimer = vi.fn((id: number) => timers.delete(id));
    let nextId = 0;
    const manager = createToastTimerManager(
      (callback) => {
        const id = ++nextId;
        timers.set(id, callback);
        return id;
      },
      clearTimer,
    );

    manager.schedule("dismissed", () => undefined, 5_000);
    manager.schedule("remaining", () => undefined, 5_000);
    manager.cancel("dismissed");
    manager.dispose();

    expect(clearTimer).toHaveBeenCalledTimes(2);
    expect(timers.size).toBe(0);
  });

  it("runs a toast callback once and forgets its timer", () => {
    const callbacks = new Map<number, () => void>();
    let nextId = 0;
    const manager = createToastTimerManager(
      (callback) => {
        const id = ++nextId;
        callbacks.set(id, () => {
          callbacks.delete(id);
          callback();
        });
        return id;
      },
      (id) => callbacks.delete(id),
    );
    const onExpire = vi.fn();

    manager.schedule("toast", onExpire, 5_000);
    callbacks.get(1)?.();
    manager.cancel("toast");

    expect(onExpire).toHaveBeenCalledOnce();
    expect(callbacks.size).toBe(0);
  });
});
