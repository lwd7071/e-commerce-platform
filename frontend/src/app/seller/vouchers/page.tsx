import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { SellerVouchersScreen } from '@/features/seller/seller-vouchers-screen';

export const metadata: Metadata = { title: 'Voucher gian hàng | Kênh người bán' };

export default function SellerVouchersPage() {
  return <ProtectedPage allowedRoles={['SELLER']}><SellerVouchersScreen /></ProtectedPage>;
}
