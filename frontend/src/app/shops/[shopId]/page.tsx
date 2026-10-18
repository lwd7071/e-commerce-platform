import type { Metadata } from "next";
import { ShopStorefrontScreen } from "@/features/catalog/shop-storefront-screen";

export const metadata: Metadata = {
  title: "Gian hàng",
  description: "Khám phá các sản phẩm đang bán tại gian hàng trên Dino.",
};

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <ShopStorefrontScreen shopId={shopId} />
  </main>;
}
