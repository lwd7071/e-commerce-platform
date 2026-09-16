export class CatalogDomainError extends Error {
  public code: string;
  public details: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'CatalogDomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('VALIDATION_FAILED', message, details);
    this.name = 'ValidationError';
  }
}

export class StockInvalidError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('STOCK_INVALID', message, details);
    this.name = 'StockInvalidError';
  }
}

export class ForbiddenError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('RESOURCE_FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class SkuConflictError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('SKU_CONFLICT', message, details);
    this.name = 'SkuConflictError';
  }
}

export class ResourceDeleteNotAllowedError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('RESOURCE_DELETE_NOT_ALLOWED', message, details);
    this.name = 'ResourceDeleteNotAllowedError';
  }
}

export class InventoryInsufficientError extends CatalogDomainError {
  constructor(message: string, details?: any) {
    super('INVENTORY_INSUFFICIENT', message, details);
    this.name = 'InventoryInsufficientError';
  }
}
