import type { Pool, PoolClient } from 'pg';
import type { IPaymentRepository, PaymentRecord, UUID } from '../domain/repositories.ts';
import type { IOrderRepository } from '../../order/domain/repositories.ts';
import type { PaymentMethod } from '../domain/types.ts';
import { createPaymentRetry, settlePendingPayment } from '../domain/payment-state-machine.ts';
import { PaymentDomainError } from '../domain/errors.ts';
import { NotFoundError } from '../../../platform/errors/app-error.ts';
import { withTransaction } from '../../../../db/transaction.ts';

export interface PaymentServiceDependencies {
  readonly pool?: Pool;
  readonly paymentRepo: IPaymentRepository;
  readonly orderRepo: IOrderRepository;
}

export class PaymentService {
  private pool?: Pool;
  private paymentRepo: IPaymentRepository;
  private orderRepo: IOrderRepository;

  constructor(deps: PaymentServiceDependencies) {
    this.pool = deps.pool;
    this.paymentRepo = deps.paymentRepo;
    this.orderRepo = deps.orderRepo;
  }

  /**
   * Retries payment for a pending order without successful payment attempts.
   */
  public async retryPayment(
    orderId: UUID,
    buyerId: string,
    method: PaymentMethod,
  ): Promise<PaymentRecord> {
    const executeRetry = async (client?: PoolClient): Promise<PaymentRecord> => {
      const order = await this.orderRepo.findById(orderId, client);
      if (!order) {
        throw new NotFoundError('Order was not found.');
      }
      if (order.buyerId !== buyerId) {
        throw new NotFoundError('Order was not found.');
      }
      if (order.status === 'CANCELLED') {
        throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'Cannot retry payment for a cancelled order.');
      }

      const existingAttempts = await this.paymentRepo.findByOrderId(orderId, client);
      const newPaymentId = crypto.randomUUID();

      const retryAttempt = createPaymentRetry(
        existingAttempts.map(a => ({
          paymentId: a.paymentId,
          orderId: a.orderId,
          status: a.status,
          method: a.method,
          amount: a.amount,
          paidAt: a.paidAt ?? null,
        })),
        {
          paymentId: newPaymentId,
          orderId,
          method,
          orderTotal: order.totalAmount,
        },
      );

      const record: PaymentRecord = {
        paymentId: retryAttempt.paymentId,
        orderId: retryAttempt.orderId,
        method: retryAttempt.method,
        amount: retryAttempt.amount,
        status: retryAttempt.status,
        createdAt: new Date().toISOString(),
        paidAt: null,
        note: 'retry',
      };

      return await this.paymentRepo.createPayment(record, client);
    };

    if (this.pool) {
      return await withTransaction(this.pool, (client) => executeRetry(client));
    }
    return await executeRetry();
  }

  /**
   * Settles a pending payment to SUCCESS or FAILED.
   */
  public async settlePayment(
    paymentId: UUID,
    outcome: 'SUCCESS' | 'FAILED',
    paidAt?: string,
  ): Promise<PaymentRecord> {
    const executeSettle = async (client?: PoolClient): Promise<PaymentRecord> => {
      const payment = client
        ? await this.paymentRepo.lockById(paymentId, client)
        : await this.paymentRepo.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment was not found.');
      }
      const order = await this.orderRepo.findById(payment.orderId, client);
      if (!order) {
        throw new NotFoundError('Order was not found.');
      }

      const settled = settlePendingPayment(
        {
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          status: payment.status,
          method: payment.method,
          amount: payment.amount,
          paidAt: payment.paidAt ?? null,
        },
        {
          outcome,
          orderTotal: order.totalAmount,
          paidAt: paidAt ?? new Date().toISOString(),
        },
      );

      await this.paymentRepo.updateStatus(
        paymentId,
        settled.status,
        settled.paidAt,
        payment.note,
        client,
      );

      return {
        ...payment,
        status: settled.status,
        paidAt: settled.paidAt,
      };
    };

    if (this.pool) {
      return await withTransaction(this.pool, (client) => executeSettle(client));
    }
    return await executeSettle();
  }
}
