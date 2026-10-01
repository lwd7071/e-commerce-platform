import type { Metadata } from "next";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminAuditScreen } from "@/features/admin/admin-audit-screen";

export const metadata: Metadata = { title: "Nhật ký quản trị - Dino" };

export default function AdminAuditPage() {
  return <ProtectedPage allowedRoles={["ADMIN"]}><AdminAuditScreen /></ProtectedPage>;
}
