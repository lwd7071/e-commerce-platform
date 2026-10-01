import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { SellerProductsScreen } from "@/features/seller/seller-products-screen";

export const metadata: Metadata = {
  title: "Quản lý sản phẩm | Kênh Người Bán",
  description: "Quản lý danh sách sản phẩm và cập nhật tồn kho nhanh.",
};

export default function SellerProductsPage() {
  return (
    <ProtectedPage allowedRoles={["SELLER"]}>
      <div className="py-6">
        <SellerProductsScreen />
      </div>
    </ProtectedPage>
  );
}
