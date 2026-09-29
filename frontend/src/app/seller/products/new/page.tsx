import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { SellerProductCreateScreen } from "@/features/seller/seller-product-create-screen";

export const metadata: Metadata = {
  title: "Thêm sản phẩm mới | Kênh Người Bán",
  description: "Tạo sản phẩm mới cho gian hàng theo chuẩn danh mục và biến thể.",
};

export default function NewProductPage() {
  return (
    <ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>
      <div className="py-6">
        <SellerProductCreateScreen />
      </div>
    </ProtectedPage>
  );
}
