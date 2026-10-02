import type { Metadata } from 'next';
import { ProtectedPage } from '@/components/navigation/protected-page';
import { AdminFinanceScreen } from '@/features/admin/admin-finance-screen';

export const metadata: Metadata = { title: 'Tài chính & Ví sàn | Quản trị viên' };

export default function AdminFinancePage() {
  return (
    <ProtectedPage allowedRoles={['ADMIN']}>
      <AdminFinanceScreen />
    </ProtectedPage>
  );
}
