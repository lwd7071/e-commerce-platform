import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { SellerProductEditScreen } from "@/features/seller/seller-product-edit-screen";

export const metadata: Metadata = { title: "Sửa sản phẩm | Kênh Người Bán" };

export default function SellerProductEditPage() {
  return <ProtectedPage allowedRoles={["SELLER"]}><div className="py-6"><SellerProductEditScreen /></div></ProtectedPage>;
}
