export class OrderDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OrderDomainError';
    this.code = code;
  }
}
