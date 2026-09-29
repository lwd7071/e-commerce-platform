import type { Metadata } from "next";
import { AdminCategoriesScreen } from "@/features/admin";

export const metadata: Metadata = {
  title: "Quản lý danh mục - Dino",
  description: "Quản trị danh mục ngành hàng toàn sàn theo quy chuẩn cây 2 cấp RB-KN04.",
};

export default function AdminCategoriesPage() {
  return (
    <div className="py-6">
      <AdminCategoriesScreen />
    </div>
  );
}
