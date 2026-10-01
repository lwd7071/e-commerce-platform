import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockAdminStore } from "@/features/admin/admin.repository";
import { repositories } from "@/lib/repositories/repository-factory";

describe("Admin repository in live mode", () => {
  beforeEach(() => {
    resetMockAdminStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("backend unavailable")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces a user-list API failure instead of returning fixture users", async () => {
    await expect(repositories.admin().getUsers()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "backend unavailable",
    });
  });

  it("surfaces a lock API failure instead of mutating fixture state", async () => {
    await expect(
      repositories.admin().lockUser({ user_id: "usr_001", reason: "Policy violation" }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "backend unavailable",
    });
  });
});
