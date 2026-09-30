import type { Metadata } from "next";
import { SellerDashboardScreen } from "@/features/seller/seller-dashboard-screen";

export const metadata: Metadata = {
  title: "Tổng quan kênh người bán | Dino Market",
  description: "Theo dõi chỉ số kinh doanh, doanh thu thực tế (QD19), đơn hàng cần xử lý và cảnh báo tồn kho.",
};

export default function SellerRootPage() {
  return <SellerDashboardScreen />;
}
