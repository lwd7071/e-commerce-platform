import { ProductDetailScreen } from "@/features/catalog/product-detail-screen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chi tiết sản phẩm",
  description: "Xem chi tiết thông tin, phân loại và giá bán sản phẩm trên Dino.",
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="py-6">
      <ProductDetailScreen productId={id} />
    </div>
  );
}
