import type { PaymentStatus, PaymentMethod } from './types.ts';

export type UUID = string;
export type DecimalString = string;

export interface PaymentRecord {
  readonly paymentId: UUID;
  readonly orderId: UUID;
  readonly transactionCode?: string | null;
  readonly method: PaymentMethod;
  readonly amount: DecimalString;
  readonly status: PaymentStatus;
  readonly createdAt: string;
  readonly paidAt?: string | null;
  readonly note?: string | null;
}

export interface IPaymentRepository {
  /**
   * Persists a payment attempt.
   */
  createPayment(payment: PaymentRecord, client?: any): Promise<PaymentRecord>;

  /**
   * Finds a payment by payment ID.
   */
  findById(paymentId: UUID, client?: any): Promise<PaymentRecord | null>;

  /**
   * Finds all payments belonging to an order.
   */
  findByOrderId(orderId: UUID, client?: any): Promise<PaymentRecord[]>;

  /**
   * Updates payment status, paidAt, and optional note.
   */
  updateStatus(
    paymentId: UUID,
    status: PaymentStatus,
    paidAt?: string | null,
    note?: string | null,
    client?: any,
  ): Promise<void>;
}
