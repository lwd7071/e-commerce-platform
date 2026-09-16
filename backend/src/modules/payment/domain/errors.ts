export class PaymentDomainError extends Error {
  readonly code: 'PAYMENT_STATE_INVALID' | 'PAYMENT_AMOUNT_INVALID' | 'PAYMENT_ALREADY_COMPLETED' | 'VALIDATION_FAILED';

  constructor(code: PaymentDomainError['code'], message: string) {
    super(message);
    this.name = 'PaymentDomainError';
    this.code = code;
  }
}
