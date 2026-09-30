import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { ReviewScreen } from "@/features/review";

export const metadata: Metadata = {
  title: "Đánh giá sản phẩm - Dino",
  description: "Gửi đánh giá và phản hồi chất lượng sản phẩm cho đơn hàng của bạn trên Dino.",
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderReviewPage({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <div className="py-6">
        <ReviewScreen orderId={id} />
      </div>
    </ProtectedPage>
  );
}
