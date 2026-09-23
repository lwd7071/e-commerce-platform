import type { TransactionDomainEvent } from '../../order/contracts/order-events.contract.ts';

export type { TransactionDomainEvent };

/**
 * Event Port cho Buyer Domain đăng ký lắng nghe các sự kiện giao dịch chính thức
 * từ Transaction Core của Người 5 (TransactionDomainEvent).
 * Nguồn: backend/src/modules/order/contracts/order-events.contract.ts
 */
export interface ITransactionEventPort {
  publish(event: TransactionDomainEvent): Promise<void>;
  subscribe(handler: (event: TransactionDomainEvent) => Promise<void>): void;
}

// Alias tương thích ngược
export type IBuyerEventPort = ITransactionEventPort;
