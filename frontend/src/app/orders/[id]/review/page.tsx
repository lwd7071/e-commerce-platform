import React from "react";
import { ProtectedPage } from "../../../../components/navigation/protected-page";
import { OrderReviewScreen } from "../../../../features/orders/order-review-screen";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;

  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <OrderReviewScreen orderId={id} />
    </ProtectedPage>
  );
}
