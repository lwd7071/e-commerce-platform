export interface SuccessEnvelope<T> {
  data: T;
  request_id: string;
}

export interface PaginationMeta {
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginationMeta;
  request_id: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  request_id: string;
}

export function buildSuccessEnvelope<T>(data: T, requestId: string): SuccessEnvelope<T> {
  return {
    data,
    request_id: requestId
  };
}

export function buildPaginatedEnvelope<T>(
  data: T[],
  meta: PaginationMeta,
  requestId: string
): PaginatedEnvelope<T> {
  return {
    data,
    meta,
    request_id: requestId
  };
}

export function buildErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: unknown
): ErrorEnvelope {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code,
    message
  };

  if (details !== undefined) {
    errorObj.details = details;
  }

  return {
    error: errorObj,
    request_id: requestId
  };
}
