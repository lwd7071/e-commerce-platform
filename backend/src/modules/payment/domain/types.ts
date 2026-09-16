export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type PaymentMethod = 'COD' | 'ONLINE';

export interface PaymentAttempt {
  readonly paymentId: string;
  readonly orderId: string;
  readonly status: PaymentStatus;
  readonly method: PaymentMethod;
  readonly amount: string;
  readonly paidAt: string | null;
}

export interface PendingPaymentOutcome {
  readonly outcome: 'SUCCESS' | 'FAILED';
  readonly orderTotal: string;
  readonly paidAt?: string;
}

export interface PaymentRetryCommand {
  readonly paymentId: string;
  readonly orderId: string;
  readonly method: PaymentMethod;
  readonly orderTotal: string;
}
