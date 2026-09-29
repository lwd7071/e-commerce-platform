import React from "react";
import { ProtectedPage } from "../../../../components/navigation/protected-page";
import { SellerCreateProductScreen } from "../../../../features/seller/seller-create-product-screen";

export default function NewProductPage() {
  return (
    <ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>
      <SellerCreateProductScreen />
    </ProtectedPage>
  );
}
