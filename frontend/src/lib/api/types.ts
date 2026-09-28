/**
 * Standard Envelope and API types matching Backend OpenAPI 3.1 Spec.
 */

export interface SuccessEnvelope<T> {
  data: T;
  request_id?: string;
}

export interface PaginatedMeta {
  limit: number;
  has_more: boolean;
  next_cursor?: string | null;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginatedMeta;
  request_id?: string;
}

export interface ErrorDetail {
  field?: string;
  message?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[] | Record<string, unknown>;
  };
  request_id?: string;
}

export type ApiResponse<T> = SuccessEnvelope<T> | PaginatedEnvelope<T>;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  skipAuth?: boolean;
  rawEnvelope?: boolean;
}
