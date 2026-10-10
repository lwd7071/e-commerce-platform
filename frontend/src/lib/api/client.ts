import { envConfig } from "../config/env";
import { AppError } from "./app-error";
import type { RequestOptions, SuccessEnvelope, PaginatedEnvelope } from "./types";

const DEFAULT_TIMEOUT_MS = 10000;

let tokenProvider: (() => Promise<string | null> | string | null) | null = null;

/**
 * Configure the global token provider (injected by AuthProvider).
 */
export function setAuthTokenProvider(provider: () => Promise<string | null> | string | null) {
  tokenProvider = provider;
}

/**
 * ApiClient - Core native fetch wrapper for Backend HTTP communication.
 * Follows F-102: Envelopes, Bearer token, 204 handling, 10s timeout, AppError, X-Request-Id.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || envConfig.apiUrl;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanBase = this.baseUrl.replace(/\/+$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${cleanBase}${cleanPath}`);

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      params,
      body,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      skipAuth = false,
      headers: customHeaders = {},
      ...fetchOptions
    } = options;

    const url = this.buildUrl(path, params);

    // Generate tracing Request ID
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const headers = new Headers(customHeaders);
    headers.set("X-Request-Id", requestId);
    headers.set("Accept", "application/json");

    // Inject Bearer token if available and not skipped
    if (!skipAuth && tokenProvider) {
      try {
        const token = await tokenProvider();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } catch {
        // Silently skip token failure, backend will respond 401 if required
      }
    }

    let requestBody: BodyInit | undefined = undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
        headers.set("Content-Type", "application/json");
        requestBody = JSON.stringify(body);
      } else {
        requestBody = body as BodyInit;
      }
    }

    // Setup Timeout Abort Controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const headerRequestId = response.headers.get("x-request-id") || requestId;

      // Handle HTTP 204 No Content safely without calling res.json()
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      // Parse JSON body safely
      let responseData: unknown = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      } else {
        try {
          responseData = await response.text();
        } catch {
          responseData = null;
        }
      }

      // Check HTTP Status
      if (!response.ok) {
        throw AppError.fromHttp(response.status, responseData, headerRequestId);
      }

      // Unwrap Success Envelope if standard { data, request_id } exists (unless rawEnvelope is requested)
      if (!options.rawEnvelope && responseData && typeof responseData === "object" && "data" in responseData) {
        return (responseData as SuccessEnvelope<T> | PaginatedEnvelope<T>).data as T;
      }

      return responseData as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        throw AppError.timeout(requestId);
      }

      const message = err instanceof Error ? err.message : String(err);
      throw AppError.networkError(message, requestId);
    }
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  getPaginated<T>(path: string, options?: RequestOptions): Promise<PaginatedEnvelope<T>> {
    return this.request<PaginatedEnvelope<T>>(path, { ...options, method: "GET", rawEnvelope: true });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
