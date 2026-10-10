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

const isPaymentStatus = (value: unknown): value is PaymentAttempt['status'] =>
  value === 'PENDING' || value === 'SUCCESS' || value === 'FAILED';

const isPaymentMethod = (value: unknown): value is PaymentAttempt['method'] =>
  value === 'COD' || value === 'ONLINE';

function validPaidAt(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

/** Only settles PENDING attempts. Provider callback deduplication is a separate use case. */
export function settlePendingPayment(payment: PaymentAttempt, command: PendingPaymentOutcome): PaymentAttempt {
  if (!isPaymentStatus(payment.status) || !isPaymentMethod(payment.method)) {
    throw new PaymentDomainError('VALIDATION_FAILED', 'Payment status or method is invalid.');
  }
  if (payment.status !== 'PENDING' || !['SUCCESS', 'FAILED'].includes(command.outcome)) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'This command only settles a pending attempt.');
  }
  if (positiveCents(payment.amount) !== positiveCents(command.orderTotal)) {
    throw new PaymentDomainError('PAYMENT_AMOUNT_INVALID', 'Payment must equal the entire Order total.');
  }
  if (command.outcome === 'SUCCESS' && !validPaidAt(command.paidAt)) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'Successful payment requires a timestamp with timezone.');
  }
  return { ...payment, status: command.outcome, paidAt: command.outcome === 'SUCCESS' ? new Date(command.paidAt!).toISOString() : null };
}

/** Caller supplies all attempts for this Order under the same transaction/lock. */
export function createPaymentRetry(attempts: readonly PaymentAttempt[], command: PaymentRetryCommand): PaymentAttempt {
  if (!isPaymentMethod(command.method)) {
    throw new PaymentDomainError('VALIDATION_FAILED', 'Payment method is invalid.');
  }
  for (const attempt of attempts) {
    if (!isPaymentStatus(attempt.status) || !isPaymentMethod(attempt.method)) {
      throw new PaymentDomainError('VALIDATION_FAILED', 'Payment attempt status or method is invalid.');
    }
  }
  if (attempts.some(attempt => attempt.orderId !== command.orderId || attempt.paymentId === command.paymentId)) {
    throw new PaymentDomainError('PAYMENT_STATE_INVALID', 'Retry requires a new ID and attempts from the same Order.');
  }
  if (attempts.some(attempt => attempt.status === 'SUCCESS')) {
    throw new PaymentDomainError('PAYMENT_ALREADY_COMPLETED', 'Order already has a successful payment.');
  }
  positiveCents(command.orderTotal);
  return { paymentId: command.paymentId, orderId: command.orderId, status: 'PENDING', method: command.method, amount: command.orderTotal, paidAt: null };
}
