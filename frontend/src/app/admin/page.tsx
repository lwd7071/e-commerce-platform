import type { Metadata } from "next";
import { AdminDashboardScreen } from "@/features/admin";

export const metadata: Metadata = {
  title: "Quản trị hệ thống - Dino",
  description: "Bảng điều khiển quản trị toàn diện dành cho Quản trị viên sàn Dino.",
};

export default function AdminPage() {
  return (
    <div className="py-6">
      <AdminDashboardScreen />
    </div>
  );
}
