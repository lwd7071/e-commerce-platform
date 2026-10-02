import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminOrdersScreen } from "@/features/admin/admin-orders-screen";

export default function AdminOrdersPage() {
  return <ProtectedPage allowedRoles={["ADMIN"]}><AdminOrdersScreen /></ProtectedPage>;
}
