/**
 * MoneyAdapter - Safe currency formatting and calculations.
 * Avoids JavaScript floating-point precision pitfalls.
 * Follows F-104 and 09-ui-ux-rules.md.
 */

export const moneyAdapter = {
  /**
   * Formats a decimal string or number to VND currency (e.g. "150000" -> "150.000 ₫").
   */
  formatVND: (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === "") {
      return "0 ₫";
    }

    const num = typeof value === "number" ? Math.round(value) : parseInt(String(value).split(".")[0], 10);
    if (isNaN(num)) {
      return "0 ₫";
    }

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(num);
  },

  /**
   * Safe integer parsing of decimal wire strings.
   */
  toInteger: (decimalString: string | null | undefined): number => {
    if (!decimalString) return 0;
    const clean = decimalString.trim().split(".")[0];
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? 0 : parsed;
  },

  /**
   * Formats raw number to backend wire format (exact decimal string "150000.00").
   */
  toWireDecimal: (amount: number): string => {
    return Math.max(0, Math.round(amount)).toFixed(2);
  },
};
