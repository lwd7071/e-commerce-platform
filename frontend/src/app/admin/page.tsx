import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminDashboardScreen } from "@/features/admin/admin-dashboard-screen";

export const metadata: Metadata = {
  title: "Quản trị hệ thống - Dino",
  description: "Bảng điều khiển quản trị toàn diện dành cho Quản trị viên sàn Dino.",
};

export default function AdminPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="py-6">
        <AdminDashboardScreen />
      </div>
    </ProtectedPage>
  );
}
