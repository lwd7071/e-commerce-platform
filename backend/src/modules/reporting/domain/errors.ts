export type ReportingErrorCode =
  | 'REPORT_FILTER_INVALID'
  | 'REPORT_ACCESS_DENIED'
  | 'VALIDATION_FAILED';

export class ReportingDomainError extends Error {
  public readonly code: ReportingErrorCode;
  public readonly details?: unknown;

  constructor(code: ReportingErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ReportingDomainError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
