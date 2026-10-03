import type { Metadata } from "next";
import { ProfilePageContent } from "../../features/profile/profile-screen";

export const metadata: Metadata = { title: "Hồ sơ cá nhân" };

export default function ProfilePage() {
  return <ProfilePageContent />;
}
