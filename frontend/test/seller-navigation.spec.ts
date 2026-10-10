import { describe, expect, it } from "vitest";
import {
  getTopNavItems,
  getSellerSidebarGroups,
  type SellerNavGroup,
} from "@/components/navigation/navigation-items";

describe("Seller Navigation & Top Navbar separation", () => {
  it("returns clean top navbar items for buyer and seller without seller tool links", () => {
    // Top navbar cho SELLER chỉ giữ các mục chung, không chứa link công cụ người bán
    const sellerTopItems = getTopNavItems("SELLER");
    const sellerHrefs = sellerTopItems.map((item) => item.href);

    expect(sellerHrefs).not.toContain("/seller/orders");
    expect(sellerHrefs).not.toContain("/seller/products");
    expect(sellerHrefs).not.toContain("/seller/vouchers");
    expect(sellerHrefs).not.toContain("/seller/reports");
    expect(sellerHrefs).not.toContain("/seller/shop");
    expect(sellerHrefs).not.toContain("/seller/chat");
  });

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

    // 4. Marketing (Mã giảm giá)
    expect(groups[3].title).toBe("Marketing");
    expect(groups[3].children).toEqual([
      { href: "/seller/vouchers", label: "Mã giảm giá" },
    ]);

    // 5. Báo cáo (Doanh thu)
    expect(groups[4].title).toBe("Báo cáo");
    expect(groups[4].children).toEqual([
      { href: "/seller/reports", label: "Doanh thu" },
    ]);

    // 6. Hồ sơ gian hàng
    expect(groups[5].title).toBe("Hồ sơ gian hàng");
    expect(groups[5].href).toBe("/seller/shop");
  });
});
