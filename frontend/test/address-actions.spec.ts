import { describe, it, expect } from "vitest";

interface Address {
  id: string;
  recipient_name: string;
  is_default: boolean;
}

function setDefaultAddress(addresses: Address[], targetId: string): Address[] {
  return addresses.map((a) => ({
    ...a,
    is_default: a.id === targetId,
  }));
}

function removeAddress(addresses: Address[], targetId: string): Address[] {
  const filtered = addresses.filter((a) => a.id !== targetId);
  const hasDefault = filtered.some((a) => a.is_default);
  if (!hasDefault && filtered.length > 0) {
    filtered[0].is_default = true;
  }
  return filtered;
}

describe("Address Management Actions (Người 4 - TDD)", () => {
  const initialAddresses: Address[] = [
    { id: "addr_1", recipient_name: "Nguyễn Văn A", is_default: true },
    { id: "addr_2", recipient_name: "Nguyễn Văn B", is_default: false },
    { id: "addr_3", recipient_name: "Nguyễn Văn C", is_default: false },
  ];

  it("đặt một địa chỉ làm mặc định thì các địa chỉ khác tự động chuyển is_default=false", () => {
    const updated = setDefaultAddress(initialAddresses, "addr_2");
    expect(updated.find((a) => a.id === "addr_2")?.is_default).toBe(true);
    expect(updated.find((a) => a.id === "addr_1")?.is_default).toBe(false);
    expect(updated.find((a) => a.id === "addr_3")?.is_default).toBe(false);
  });

  it("xóa một địa chỉ khỏi danh sách", () => {
    const updated = removeAddress(initialAddresses, "addr_3");
    expect(updated.length).toBe(2);
    expect(updated.find((a) => a.id === "addr_3")).toBeUndefined();
  });

  it("khi xóa địa chỉ mặc định, tự động gán địa chỉ đầu tiên còn lại làm mặc định", () => {
    const updated = removeAddress(initialAddresses, "addr_1");
    expect(updated.length).toBe(2);
    expect(updated[0].id).toBe("addr_2");
    expect(updated[0].is_default).toBe(true);
  });
});
