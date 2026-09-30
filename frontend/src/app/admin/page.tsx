import React from "react";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { AdminScreen } from "../../features/admin/admin-screen";

export default function AdminPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <AdminScreen />
    </ProtectedPage>
  );
}
