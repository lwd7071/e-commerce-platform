// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminReportsScreen } from "../src/features/admin/admin-reports-screen";

describe("Admin operational reports", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {
      from: "2026-10-01", to: "2026-10-02", ordersByStatus: [{ status: "COMPLETED", count: 2 }],
      dailyGmv: [{ date: "2026-10-01", orderCount: 2, gmv: "250000.00" }],
      topShops: [{ name: "Shop A", orderCount: 2, gmv: "250000.00" }],
      topProducts: [{ name: "Item A", quantitySold: 3, gmv: "250000.00" }],
      moderationActions: [{ action: "HIDE", count: 1 }],
    }, request_id: "req-test" }), { status: 200, headers: { "content-type": "application/json" } }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("loads the date range and shows report tables equivalent to the chart data", async () => {
    render(<AdminReportsScreen />);
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem báo cáo" }));
    expect((await screen.findAllByText("250000.00")).length).toBe(4);
    expect(screen.getByText("Shop A")).toBeTruthy();
    expect(screen.getByText("Item A")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("from=2026-10-01"), expect.anything()));
  });

  it("keeps a useful error and retry action when the report request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Service unavailable"));
    render(<AdminReportsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Xem báo cáo" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Service unavailable")).toBeTruthy();
  });
});
