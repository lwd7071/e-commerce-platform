// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminCampaignsScreen } from "../src/features/admin/admin-campaigns-screen";

describe("Admin notification campaigns", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: { campaign_id: "campaign-1", audience_role: "BUYER", title: "Sale", content: "Read now", status: "PENDING", recipient_count: 12, delivered_count: 0, created_at: "2026-10-02T00:00:00Z" }, request_id: "req-test" }), { status: 201, headers: { "content-type": "application/json" } }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("sends to one selected group with an idempotency key and displays progress", async () => {
    render(<AdminCampaignsScreen />);
    fireEvent.change(screen.getByLabelText(/^Nhóm nhận/), { target: { value: "BUYER" } });
    fireEvent.change(screen.getByLabelText(/^Tiêu đề/), { target: { value: "Sale" } });
    fireEvent.change(screen.getByLabelText(/^Nội dung/), { target: { value: "Read now" } });
    fireEvent.change(screen.getByLabelText(/^Lý do/), { target: { value: "Approved campaign" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo và gửi chiến dịch" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/notification-campaigns"), expect.objectContaining({ method: "POST" })));
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(new Headers(call?.[1]?.headers).get("Idempotency-Key")).toBeTruthy();
    expect(call?.[1]?.body).toContain('"audience_role":"BUYER"');
    expect(await screen.findByText(/0 \/ 12/)).toBeTruthy();
  });
});
