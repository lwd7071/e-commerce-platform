import { AdminVouchersScreen } from "@/features/admin/admin-vouchers-screen";
import { ProtectedPage } from "@/components/navigation/protected-page";

export default function AdminVouchersPage() {
  return <ProtectedPage allowedRoles={["ADMIN"]}><AdminVouchersScreen /></ProtectedPage>;
}
