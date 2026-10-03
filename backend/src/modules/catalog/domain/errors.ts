export class CatalogDomainError extends Error {
  public code: string;
  public details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'CatalogDomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

export class StockInvalidError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('STOCK_INVALID', message, details);
    this.name = 'StockInvalidError';
  }
}

export class ForbiddenError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('RESOURCE_FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class SkuConflictError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('SKU_CONFLICT', message, details);
    this.name = 'SkuConflictError';
  }
}

export class ResourceDeleteNotAllowedError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('RESOURCE_DELETE_NOT_ALLOWED', message, details);
    this.name = 'ResourceDeleteNotAllowedError';
  }
}

export class InventoryInsufficientError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('INVENTORY_INSUFFICIENT', message, details);
    this.name = 'InventoryInsufficientError';
  }
}

export class ResourceNotFoundError extends CatalogDomainError {
  constructor(message: string, details?: unknown) {
    super('RESOURCE_NOT_FOUND', message, details);
    this.name = 'ResourceNotFoundError';
  }
}

