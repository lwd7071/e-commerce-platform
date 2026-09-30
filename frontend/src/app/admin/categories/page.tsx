import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminCategoriesScreen } from "@/features/admin/admin-categories-screen";

export const metadata: Metadata = {
  title: "Quản lý danh mục - Dino",
  description: "Quản trị danh mục ngành hàng toàn sàn theo quy chuẩn cây 2 cấp RB-KN04.",
};

export default function AdminCategoriesPage() {
  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="py-6">
        <AdminCategoriesScreen />
      </div>
    </ProtectedPage>
  );
}
