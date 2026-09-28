import type { Metadata } from "next";
import { CheckoutPageContent } from "@/features/checkout/checkout-screen";

export const metadata: Metadata = {
  title: "Thanh toán - Dino",
  description: "Xác nhận địa chỉ và hoàn tất đặt hàng Dino an toàn.",
};

export default function CheckoutPage() {
  return <CheckoutPageContent />;
}
