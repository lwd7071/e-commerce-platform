import React from "react";
import { ProtectedPage } from "../../../components/navigation/protected-page";
import { AdminShopsScreen } from "../../../features/admin/admin-shops-screen";

export default function AdminShopsPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <AdminShopsScreen />
    </ProtectedPage>
  );
}
