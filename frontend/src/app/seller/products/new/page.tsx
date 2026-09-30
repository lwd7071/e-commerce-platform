import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { SellerCreateProductScreen } from "@/features/seller/seller-create-product-screen";

export const metadata: Metadata = {
  title: "Thêm sản phẩm mới | Kênh Người Bán",
  description: "Tạo sản phẩm mới cho gian hàng theo chuẩn danh mục và biến thể.",
};

export default function NewProductPage() {
  return (
    <ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>
      <div className="py-6">
        <SellerCreateProductScreen />
      </div>
    </ProtectedPage>
  );
}
