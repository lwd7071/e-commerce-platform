// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminVouchersScreen } from "../src/features/admin/admin-vouchers-screen";

const platformVoucher = { voucher_id: "voucher-1", code: "PLATFORM10", voucher_name: "Platform sale", scope: "PLATFORM", shop_id: null, discount_type: "PERCENT", discount_value: "10.00", max_discount: "50000.00", min_order_value: "100000.00", quantity: 10, start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-31T00:00:00Z", status: "ACTIVE", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };

describe("Admin platform vouchers", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const isPost = init?.method === "POST";
      const payload = isPost ? { data: { ...platformVoucher, voucher_id: "voucher-2", code: "WELCOME15", voucher_name: "Welcome", scope: "PLATFORM", shop_id: null }, request_id: "req-test" } : { data: [platformVoucher], request_id: "req-test" };
      return new Response(JSON.stringify(payload), { status: isPost ? 201 : 200, headers: { "content-type": "application/json" } });
    });
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("creates an explicitly platform scoped voucher and reloads the table", async () => {
    render(<AdminVouchersScreen />);
    expect(await screen.findByText("PLATFORM10")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Mã voucher/), { target: { value: "WELCOME15" } });
    fireEvent.change(screen.getByLabelText(/^Tên voucher/), { target: { value: "Welcome" } });
    fireEvent.change(screen.getByLabelText(/^Giá trị giảm/), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText(/^Lý do tạo/), { target: { value: "Campaign approved" } });
    fireEvent.change(screen.getByLabelText(/^Bắt đầu/), { target: { value: "2026-10-01T10:00" } });
    fireEvent.change(screen.getByLabelText(/^Kết thúc/), { target: { value: "2026-10-31T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo voucher nền tảng" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/vouchers"), expect.objectContaining({ method: "POST" })));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall?.[1]?.body).toContain('"scope":"PLATFORM"');
  });

  it("updates a PLATFORM voucher with a reason", async () => {
    render(<AdminVouchersScreen />);
    expect(await screen.findByText("PLATFORM10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText(/^Tên voucher/), { target: { value: "Updated platform sale" } });
    fireEvent.change(screen.getByLabelText(/^Lý do tạo/), { target: { value: "Revised campaign terms" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/admin/vouchers/voucher-1"), expect.objectContaining({ method: "PATCH" })));
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall?.[1]?.body).toContain('"reason":"Revised campaign terms"');
  });
});
