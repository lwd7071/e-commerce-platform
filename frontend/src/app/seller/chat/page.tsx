import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { SellerChatInboxScreen } from '@/features/seller/seller-chat-inbox-screen';

export const metadata: Metadata = { title: 'Tin nhắn khách hàng | Kênh người bán' };

export default function SellerChatPage() {
  return (
    <ProtectedPage allowedRoles={['SELLER']}>
      <SellerChatInboxScreen />
    </ProtectedPage>
  );
}
