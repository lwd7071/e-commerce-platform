import type { Metadata } from "next";
import { AdminReviewsScreen } from "@/features/admin/admin-reviews-screen";

export const metadata: Metadata = { title: "Kiểm duyệt đánh giá - Admin" };

export default function AdminReviewsPage() {
  return <div className="py-6 px-4 sm:px-6"><AdminReviewsScreen /></div>;
}
