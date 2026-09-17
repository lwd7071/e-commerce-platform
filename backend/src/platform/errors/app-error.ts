export class AppError extends Error {
  public readonly httpStatus: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(httpStatus: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'RESOURCE_NOT_FOUND', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'AUTH_REQUIRED', message = 'Authentication required', details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Access forbidden', details?: unknown) {
    super(403, code, message, details);
  }
}

export class UserLockedError extends AppError {
  constructor(message = 'User account is locked', details?: unknown) {
    super(403, 'USER_LOCKED', message, details);
  }
}

export class ValidationFailedError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(422, 'VALIDATION_FAILED', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Conflict occurred', details?: unknown) {
    super(409, code, message, details);
  }
}

export class InvalidRequestError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(400, 'INVALID_REQUEST', message, details);
  }
}

export class AuthConfigurationError extends AppError {
  constructor(message = 'Auth service configuration error') {
    super(500, 'AUTH_CONFIGURATION_ERROR', message);
  }
}
