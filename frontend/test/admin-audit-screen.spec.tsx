// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminAuditScreen } from "../src/features/admin/admin-audit-screen";

describe("Admin audit viewer", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: "log-1", action: "HIDE", targetType: "PRODUCT", targetId: "product-1", reason: "Policy", actor: "admin@example.test", createdAt: "2026-10-01T10:00:00Z" }], meta: { next_cursor: null, has_more: false, limit: 20 }, request_id: "req-test" }), { status: 200, headers: { "content-type": "application/json" } }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("filters audit rows and opens a link to the target resource", async () => {
    render(<AdminAuditScreen />);
    expect(await screen.findByText("admin@example.test")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Hành động"), { target: { value: "HIDE" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc nhật ký" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("action=HIDE"), expect.anything()));
    expect(screen.getByRole("link", { name: "Mở đối tượng" }).getAttribute("href")).toBe("/admin");
  });

  it("shows an accessible error and lets the Admin retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Audit unavailable"));
    render(<AdminAuditScreen />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("admin@example.test")).toBeTruthy();
  });
});
