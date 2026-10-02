import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { SellerWalletScreen } from '@/features/seller/seller-wallet-screen';

export const metadata: Metadata = { title: 'Ví người bán | Kênh người bán' };

export default function SellerWalletPage() {
  return (
    <ProtectedPage allowedRoles={['SELLER']}>
      <SellerWalletScreen />
    </ProtectedPage>
  );
}
