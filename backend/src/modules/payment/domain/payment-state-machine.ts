import type { PaymentAttempt, PaymentRetryCommand, PendingPaymentOutcome } from './types.ts';
import { PaymentDomainError } from './errors.ts';

function positiveCents(value: string): bigint {
  if (typeof value !== 'string' || !/^\d{1,13}(?:\.\d{1,2})?$/.test(value)) {
    throw new PaymentDomainError('PAYMENT_AMOUNT_INVALID', 'A NUMERIC(15,2) decimal amount is required.');
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n) throw new PaymentDomainError('PAYMENT_AMOUNT_INVALID', 'Payment amount must be positive.');
  return cents;
}

/** Only settles PENDING attempts. Provider callback deduplication is a separate use case. */
export function settlePendingPayment(payment: PaymentAttempt, command: PendingPaymentOutcome): PaymentAttempt {
  if (!['PENDING', 'SUCCESS', 'FAILED'].includes(payment.status)) {
    throw new PaymentDomainError('VALIDATION_FAILED', 'Payment status is invalid.');
  }
  if (payment.status !== 'PENDING' || !['SUCCESS', 'FAILED'].includes(command.outcome)) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'This command only settles a pending attempt.');
  }
  if (positiveCents(payment.amount) !== positiveCents(command.orderTotal)) {
    throw new PaymentDomainError('PAYMENT_AMOUNT_INVALID', 'Payment must equal the entire Order total.');
  }
  if (command.outcome === 'SUCCESS' && (
    typeof command.paidAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(command.paidAt)
    || !Number.isFinite(Date.parse(command.paidAt))
  )) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'Successful payment requires a timestamp with timezone.');
  }
  return { ...payment, status: command.outcome, paidAt: command.outcome === 'SUCCESS' ? command.paidAt! : null };
}

/** Caller supplies all attempts for this Order under the same transaction/lock. */
export function createPaymentRetry(attempts: readonly PaymentAttempt[], command: PaymentRetryCommand): PaymentAttempt {
  if (attempts.some(attempt => attempt.orderId !== command.orderId || attempt.paymentId === command.paymentId)) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'Retry requires a new ID and attempts from the same Order.');
  }
  if (attempts.some(attempt => attempt.status === 'SUCCESS')) {
    throw new PaymentDomainError('PAYMENT_ALREADY_COMPLETED', 'Order already has a successful payment.');
  }
  positiveCents(command.orderTotal);
  return { paymentId: command.paymentId, orderId: command.orderId, status: 'PENDING', method: command.method, amount: command.orderTotal, paidAt: null };
}
