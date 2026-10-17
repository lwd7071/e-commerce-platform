import { describe, expect, it } from "vitest";
import { getSellerSidebarGroups, type SellerNavGroup } from "@/components/navigation/navigation-items";

describe("Seller sidebar navigation", () => {
  it("returns grouped seller sidebar items matching Shopee/Lazada structure", () => {
    const groups: SellerNavGroup[] = getSellerSidebarGroups();

    // 1. Tổng quan
    expect(groups[0].title).toBe("Tổng quan");
    expect(groups[0].href).toBe("/seller");

    // 2. Đơn hàng (Đơn bán, Tin nhắn khách hàng)
    expect(groups[1].title).toBe("Đơn hàng");
    expect(groups[1].children).toEqual([
      { href: "/seller/orders", label: "Đơn bán" },
      { href: "/seller/chat", label: "Tin nhắn khách hàng" },
    ]);

    // 3. Sản phẩm
    expect(groups[2].title).toBe("Sản phẩm");
    expect(groups[2].href).toBe("/seller/products");

    // 4. Wallet
    expect(groups[3]).toMatchObject({ title: "Ví người bán", href: "/seller/wallet" });

    // 5. Marketing (Mã giảm giá)
    expect(groups[4].title).toBe("Marketing");
    expect(groups[4].children).toEqual([
      { href: "/seller/vouchers", label: "Mã giảm giá" },
    ]);

    // 6. Báo cáo (Doanh thu)
    expect(groups[5].title).toBe("Báo cáo");
    expect(groups[5].children).toEqual([
      { href: "/seller/reports", label: "Doanh thu" },
    ]);

    // 7. Hồ sơ gian hàng
    expect(groups[6].title).toBe("Hồ sơ gian hàng");
    expect(groups[6].href).toBe("/seller/shop");
  });
});
