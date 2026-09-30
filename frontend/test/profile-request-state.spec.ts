import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/api/app-error";
import { profileFailureState } from "../src/features/profile/profile-request-state";

describe("profile request failure states", () => {
  it("treats an expired session as signed out", () => {
    expect(profileFailureState(new AppError({ status: 401, code: "UNAUTHORIZED", message: "Sign in" })))
      .toEqual({ status: "signed_out" });
  });

  it("distinguishes a missing profile from an API failure", () => {
    expect(profileFailureState(new AppError({ status: 404, code: "RESOURCE_NOT_FOUND", message: "Missing" })))
      .toEqual({ status: "missing" });
    expect(profileFailureState(new AppError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Offline" })))
      .toEqual({ status: "error", message: "Offline", code: "SERVICE_UNAVAILABLE" });
    expect(profileFailureState(new AppError({ status: 404, code: "ROUTE_NOT_FOUND", message: "Wrong route" })))
      .toMatchObject({ status: "error", code: "ROUTE_NOT_FOUND" });
  });

  it("does not treat a generic 404 as a missing profile", () => {
    expect(profileFailureState(new AppError({ status: 404, code: "NOT_FOUND", message: "Route missing" })))
      .toEqual({ status: "error", message: "Route missing", code: "NOT_FOUND" });
  });

  it("preserves request IDs and a useful message for retryable failures", () => {
    expect(profileFailureState(new AppError({
      status: 500, code: "INTERNAL_SERVER_ERROR", message: "Try again", requestId: "req_profile_1",
    }))).toEqual({ status: "error", message: "Try again", code: "INTERNAL_SERVER_ERROR", requestId: "req_profile_1" });
    expect(profileFailureState(new Error("Network down"))).toEqual({ status: "error", message: "Network down" });
  });
});
