import type { IWalletRepository, EscrowRecord, ShopWallet, WalletTransaction } from '../domain/wallet.types.ts';

export class EscrowService {
  constructor(private readonly walletRepo: IWalletRepository) {}

  async createEscrow(input: {
    order_id: string;
    shop_id: string;
    gross_amount: string;
    commission_rate?: number;
  }): Promise<EscrowRecord> {
    return this.walletRepo.createEscrow(input);
  }

  async getEscrowByOrderId(orderId: string): Promise<EscrowRecord | null> {
    return this.walletRepo.findEscrowByOrderId(orderId);
  }

  async settleEscrow(orderId: string): Promise<{ escrow: EscrowRecord; wallet: ShopWallet; transaction: WalletTransaction } | null> {
    return this.walletRepo.settleEscrow(orderId);
  }

  async refundEscrow(orderId: string): Promise<EscrowRecord | null> {
    return this.walletRepo.refundEscrow(orderId);
  }
}
