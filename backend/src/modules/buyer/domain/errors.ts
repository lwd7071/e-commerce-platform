export class BuyerDomainError extends Error {
  public code: string;
  public details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'BuyerDomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

export class ResourceForbiddenError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('RESOURCE_FORBIDDEN', message, details);
    this.name = 'ResourceForbiddenError';
  }
}

export class ResourceNotFoundError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('RESOURCE_NOT_FOUND', message, details);
    this.name = 'ResourceNotFoundError';
  }
}

export class CartConflictError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('CART_CONFLICT', message, details);
    this.name = 'CartConflictError';
  }
}

export class CartItemConflictError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('CART_ITEM_CONFLICT', message, details);
    this.name = 'CartItemConflictError';
  }
}

export class DefaultAddressConflictError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('DEFAULT_ADDRESS_CONFLICT', message, details);
    this.name = 'DefaultAddressConflictError';
  }
}

export class VoucherNotApplicableError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('VOUCHER_NOT_APPLICABLE', message, details);
    this.name = 'VoucherNotApplicableError';
  }
}

export class VoucherCodeConflictError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('VOUCHER_CODE_CONFLICT', message, details);
    this.name = 'VoucherCodeConflictError';
  }
}

export class VoucherAlreadyAppliedError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('VOUCHER_ALREADY_APPLIED', message, details);
    this.name = 'VoucherAlreadyAppliedError';
  }
}

export class ReviewNotEligibleError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('REVIEW_NOT_ELIGIBLE', message, details);
    this.name = 'ReviewNotEligibleError';
  }
}

export class ReviewAlreadyExistsError extends BuyerDomainError {
  constructor(message: string, details?: unknown) {
    super('REVIEW_ALREADY_EXISTS', message, details);
    this.name = 'ReviewAlreadyExistsError';
  }
}
