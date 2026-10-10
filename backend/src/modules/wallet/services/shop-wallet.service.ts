import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ForbiddenError, AppError } from '../../../platform/errors/app-error.ts';
import type {
  IWalletRepository,
  ShopWallet,
  UpdateBankInfoInput,
  WithdrawalRequest,
  WalletTransaction,
} from '../domain/wallet.types.ts';
import { WalletDomainError } from '../domain/wallet-errors.ts';

export class ShopWalletService {
  constructor(private readonly walletRepo: IWalletRepository) {}

  private assertActiveSeller(context: RequestContext): string {
    if (context.role !== 'SELLER' || !context.shop_id || context.shop_status !== 'ACTIVE') {
      throw new ForbiddenError('SHOP_NOT_ACTIVE', 'Chỉ người bán có gian hàng đang hoạt động mới có quyền truy cập ví.');
    }
    return context.shop_id;
  }

  async getWallet(context: RequestContext): Promise<ShopWallet> {
    const shopId = this.assertActiveSeller(context);
    return this.walletRepo.getOrCreateWallet(shopId);
  }

  async updateBankInfo(context: RequestContext, bankInfo: UpdateBankInfoInput): Promise<ShopWallet> {
    const shopId = this.assertActiveSeller(context);
    if (!bankInfo.bank_name || !bankInfo.bank_account_number || !bankInfo.bank_account_holder) {
      throw new AppError(400, 'INVALID_BANK_INFO', 'Vui lòng điền đầy đủ tên ngân hàng, số tài khoản và tên chủ tài khoản.');
    }
    return this.walletRepo.updateBankInfo(shopId, bankInfo);
  }

  async requestWithdrawal(context: RequestContext, amount: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const shopId = this.assertActiveSeller(context);
    try {
      return await this.walletRepo.requestWithdrawal(shopId, amount);
    } catch (error) {
      if (error instanceof WalletDomainError) {
        throw new AppError(422, error.code, error.message);
      }
      throw error;
    }
  }

  async listTransactions(context: RequestContext, limit = 50): Promise<WalletTransaction[]> {
    const shopId = this.assertActiveSeller(context);
    return this.walletRepo.listTransactions(shopId, limit);
  }

  async listWithdrawals(context: RequestContext): Promise<WithdrawalRequest[]> {
    const shopId = this.assertActiveSeller(context);
    return this.walletRepo.listWithdrawalRequests({ shop_id: shopId });
  }
}
