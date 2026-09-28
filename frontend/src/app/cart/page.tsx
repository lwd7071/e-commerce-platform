import type { Metadata } from "next";
import { CartPageContent } from "@/features/cart/cart-screen";

export const metadata: Metadata = {
  title: "Giỏ hàng - Dino",
  description: "Quản lý và đặt mua sản phẩm trong giỏ hàng Dino.",
};

export default function CartPage() {
  return <CartPageContent />;
}
