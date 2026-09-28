import { describe, it, expect } from "vitest";
import { moneyAdapter } from "@/lib/adapters/money.adapter";

describe("MoneyAdapter (F-104)", () => {
  it("formats decimal string to VND currency correctly", () => {
    const formatted = moneyAdapter.formatVND("150000.00");
    // vi-VN format contains 150.000 followed by currency symbol (or non-breaking space)
    expect(formatted).toMatch(/150\.000/);
  });

  it("handles null, undefined, or empty values safely", () => {
    expect(moneyAdapter.formatVND(null)).toMatch(/0/);
    expect(moneyAdapter.formatVND(undefined)).toMatch(/0/);
    expect(moneyAdapter.formatVND("")).toMatch(/0/);
  });

  it("parses decimal string to safe integer without floating point error", () => {
    expect(moneyAdapter.toInteger("150000.00")).toBe(150000);
    expect(moneyAdapter.toInteger("250.75")).toBe(250);
  });

  it("converts number to wire decimal format", () => {
    expect(moneyAdapter.toWireDecimal(150000)).toBe("150000.00");
    expect(moneyAdapter.toWireDecimal(0)).toBe("0.00");
  });
});
