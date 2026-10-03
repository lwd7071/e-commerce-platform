import type { Metadata } from "next";
import { NotificationsPageContent } from "../../features/notifications/notifications-screen";

export const metadata: Metadata = { title: "Thông báo" };

export default function NotificationsPage() {
  return <NotificationsPageContent production={process.env.NODE_ENV === "production"} />;
}
