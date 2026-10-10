import type { Metadata } from "next";
import { SellerOrdersScreen } from "@/features/seller/seller-orders-screen";

export const metadata: Metadata = {
  title: "Xử lý đơn hàng - Kênh người bán Dino",
  description: "Quản lý đơn hàng, xác nhận và cập nhật tiến trình giao hàng của gian hàng Dino.",
};

export default function SellerOrdersPage() {
  return <SellerOrdersScreen />;
}
