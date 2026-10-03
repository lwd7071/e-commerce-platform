import type { IPaymentRepository, PaymentRecord, UUID } from '../domain/repositories.ts';
import type { PaymentStatus } from '../domain/types.ts';
import type { DatabaseExecutor } from '../../../../db/types.ts';

export class InMemoryPaymentRepository implements IPaymentRepository {
  private payments = new Map<UUID, PaymentRecord>();

  public async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    this.payments.set(payment.paymentId, { ...payment });
    return this.payments.get(payment.paymentId)!;
  }

  public async findById(paymentId: UUID): Promise<PaymentRecord | null> {
    const payment = this.payments.get(paymentId);
    return payment ? { ...payment } : null;
  }

  public async lockById(paymentId: UUID, _client: DatabaseExecutor): Promise<PaymentRecord | null> {
    return this.findById(paymentId);
  }

  public async findByOrderId(orderId: UUID): Promise<PaymentRecord[]> {
    return Array.from(this.payments.values())
      .filter(p => p.orderId === orderId)
      .map(p => ({ ...p }));
  }

  public async updateStatus(
    paymentId: UUID,
    status: PaymentStatus,
    paidAt?: string | null,
    note?: string | null,
  ): Promise<void> {
    const payment = this.payments.get(paymentId);
    if (!payment) return;
    this.payments.set(paymentId, {
      ...payment,
      status,
      paidAt: paidAt !== undefined ? paidAt : payment.paidAt,
      note: note !== undefined ? note : payment.note,
    });
  }

  public clear(): void {
    this.payments.clear();
  }
}
