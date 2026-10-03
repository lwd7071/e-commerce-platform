import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { SellerReportsScreen } from '@/features/seller/seller-reports-screen';

export const metadata: Metadata = { title: 'Báo cáo doanh thu | Kênh người bán' };

export default function SellerReportsPage() {
  return <ProtectedPage allowedRoles={['SELLER']}><SellerReportsScreen /></ProtectedPage>;
}
