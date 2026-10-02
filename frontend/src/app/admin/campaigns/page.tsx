import { ProtectedPage } from "@/components/navigation/protected-page";
import { AdminCampaignsScreen } from "@/features/admin/admin-campaigns-screen";

export default function AdminCampaignsPage() {
  return <ProtectedPage allowedRoles={["ADMIN"]}><AdminCampaignsScreen /></ProtectedPage>;
}
