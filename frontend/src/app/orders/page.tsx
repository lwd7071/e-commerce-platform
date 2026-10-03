import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersScreen } from "@/features/orders";
import { Skeleton } from "@/components/ui/data-states";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi - Dino",
  description: "Theo dõi trạng thái, lịch sử và chi tiết các đơn hàng của bạn trên Dino.",
};

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <Skeleton height={32} className="w-1/3" />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      }
    >
      <OrdersScreen />
    </Suspense>
  );
}
