import React from "react";
import { ProtectedPage } from "../../../components/navigation/protected-page";
import { AdminCategoriesScreen } from "../../../features/admin/admin-categories-screen";

export default function AdminCategoriesPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <AdminCategoriesScreen />
    </ProtectedPage>
  );
}
