import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { SellerShopScreen } from '@/features/seller/seller-shop-screen';

export const metadata: Metadata = { title: 'Hồ sơ gian hàng | Kênh người bán' };

export default function SellerShopPage() {
  return <ProtectedPage allowedRoles={['SELLER']}><SellerShopScreen /></ProtectedPage>;
}
