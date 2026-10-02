import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ForbiddenError, AppError } from '../../../platform/errors/app-error.ts';
import type {
  IWalletRepository,
  FinanceOverview,
  WithdrawalRequest,
  ShopWallet,
  WalletTransaction,
  WithdrawalStatus,
} from '../domain/wallet.types.ts';
import { WalletDomainError } from '../domain/wallet-errors.ts';

export class AdminFinanceService {
  constructor(private readonly walletRepo: IWalletRepository) {}

  private assertAdmin(context: RequestContext): void {
    if (context.role !== 'ADMIN') {
      throw new ForbiddenError('ADMIN_REQUIRED', 'Chỉ quản trị viên mới có quyền truy cập báo cáo tài chính và duyệt rút tiền.');
    }
  }

  async getOverview(context: RequestContext): Promise<FinanceOverview> {
    this.assertAdmin(context);
    return this.walletRepo.getFinanceOverview();
  }

  async listWithdrawals(context: RequestContext, filter?: { shop_id?: string; status?: WithdrawalStatus }): Promise<WithdrawalRequest[]> {
    this.assertAdmin(context);
    return this.walletRepo.listWithdrawalRequests(filter);
  }

  async approveWithdrawal(
    context: RequestContext,
    requestId: string,
    note?: string,
  ): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    this.assertAdmin(context);
    try {
      return await this.walletRepo.approveWithdrawal(requestId, context.user_id, note);
    } catch (error) {
      if (error instanceof WalletDomainError) {
        throw new AppError(422, error.code, error.message);
      }
      throw error;
    }
  }

  async rejectWithdrawal(
    context: RequestContext,
    requestId: string,
    note?: string,
  ): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    this.assertAdmin(context);
    try {
      return await this.walletRepo.rejectWithdrawal(requestId, context.user_id, note);
    } catch (error) {
      if (error instanceof WalletDomainError) {
        throw new AppError(422, error.code, error.message);
      }
      throw error;
    }
  }
}
