import type { ErrorEnvelope } from "./types";

/**
 * Standardized application error class for Frontend.
 * Follows F-102: status, code, message, details, requestId.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(params.message);
    this.name = "AppError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.requestId = params.requestId;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static fromHttp(status: number, body: unknown, headerRequestId?: string): AppError {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed with status ${status}`;
    let details: unknown = undefined;
    let requestId = headerRequestId;

    if (body && typeof body === "object") {
      const envelope = body as Partial<ErrorEnvelope>;
      if (envelope.request_id) {
        requestId = envelope.request_id;
      }
      if (envelope.error && typeof envelope.error === "object") {
        const errObj = envelope.error;
        if (typeof errObj.code === "string") {
          code = errObj.code;
        }
        if (typeof errObj.message === "string") {
          message = errObj.message;
        }
        if (errObj.details !== undefined) {
          details = errObj.details;
        }
      }
    }

    // Default code fallback based on HTTP status
    if (code === "UNKNOWN_ERROR") {
      switch (status) {
        case 400:
          code = "BAD_REQUEST";
          break;
        case 401:
          code = "UNAUTHORIZED";
          break;
        case 403:
          code = "FORBIDDEN";
          break;
        case 404:
          code = "NOT_FOUND";
          break;
        case 409:
          code = "CONFLICT";
          break;
        case 422:
          code = "UNPROCESSABLE_ENTITY";
          break;
        case 429:
          code = "RATE_LIMIT_EXCEEDED";
          break;
        case 500:
          code = "INTERNAL_SERVER_ERROR";
          break;
        case 503:
          code = "SERVICE_UNAVAILABLE";
          break;
      }
    }

    return new AppError({
      status,
      code,
      message,
      details,
      requestId,
    });
  }

  static timeout(requestId?: string): AppError {
    return new AppError({
      status: 408,
      code: "REQUEST_TIMEOUT",
      message: "The server took too long to respond (timeout after 10s).",
      requestId,
    });
  }

  static networkError(message: string, requestId?: string): AppError {
    return new AppError({
      status: 0,
      code: "NETWORK_ERROR",
      message: message || "Network connection failed. Please check your internet connection.",
      requestId,
    });
  }
}
