import { afterEach, describe, expect, it, vi } from "vitest";

describe("domain mock flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not force the orders screen onto fixtures when live mode is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
    vi.resetModules();

    const { features } = await import("../src/lib/config/features");

    expect(features.domains.ordersMock()).toBe(false);
  });

  it("keeps orders fixtures available in explicit mock mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "true");
    vi.resetModules();

    const { features } = await import("../src/lib/config/features");

    expect(features.domains.ordersMock()).toBe(true);
  });
});
