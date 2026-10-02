import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminReportsScreen } from "@/features/admin/admin-reports-screen";

export const metadata: Metadata = { title: "Báo cáo vận hành - Dino" };

export default function AdminReportsPage() {
  return <ProtectedPage allowedRoles={["ADMIN"]}><div className="py-6"><AdminReportsScreen /></div></ProtectedPage>;
}
