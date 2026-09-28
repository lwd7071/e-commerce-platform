import type { CheckoutPayload } from "./checkout.types";

const IDEMPOTENCY_STORAGE_KEY = "dino_checkout_idempotency_v1";

export interface StoredIdempotencySnapshot {
  key: string;
  fingerprint: string;
  payload: CheckoutPayload;
  createdAt: number;
}

// In-memory fallback for Node/SSR environments
const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      // Fallback
    }
  }
  return memoryStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, value);
      return;
    } catch {
      // Fallback
    }
  }
  memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Fallback
    }
  }
  memoryStorage.delete(key);
}

/**
 * Standard UUID v4 generator with fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Computes deterministic fingerprint from checkout payload
 * according to backend rules: (address_id, payment_method, sorted vouchers).
 */
export function computePayloadFingerprint(payload: CheckoutPayload): string {
  const sortedVouchers = [...payload.vouchers].sort((a, b) =>
    a.shop_id.localeCompare(b.shop_id) || a.code.localeCompare(b.code)
  );

  return JSON.stringify({
    a: payload.address_id,
    p: payload.payment_method,
    v: sortedVouchers,
  });
}

/**
 * Manages Idempotency-Key lifecycle:
 * - If same payload fingerprint is in session, reuse existing key (retry case).
 * - If payload has changed, generate a new key and update snapshot.
 */
export function getOrCreateIdempotencyKey(payload: CheckoutPayload): {
  key: string;
  isRetry: boolean;
} {
  const fingerprint = computePayloadFingerprint(payload);

  try {
    const storedRaw = getStorageItem(IDEMPOTENCY_STORAGE_KEY);
    if (storedRaw) {
      const stored: StoredIdempotencySnapshot = JSON.parse(storedRaw);
      // If payload fingerprint matches, REUSE existing key for idempotent retry
      if (stored.fingerprint === fingerprint && stored.key) {
        return { key: stored.key, isRetry: true };
      }
    }
  } catch {
    // Ignore read errors
  }

  // New intent or changed payload: generate new key
  const newKey = generateUUID();
  try {
    const newSnapshot: StoredIdempotencySnapshot = {
      key: newKey,
      fingerprint,
      payload,
      createdAt: Date.now(),
    };
    setStorageItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(newSnapshot));
  } catch {
    // Ignore storage write errors
  }

  return { key: newKey, isRetry: false };
}

/**
 * Clears idempotency snapshot upon successful order creation.
 */
export function clearIdempotencySnapshot(): void {
  removeStorageItem(IDEMPOTENCY_STORAGE_KEY);
}

/**
 * Retrieves the current pending idempotency snapshot if any.
 */
export function getPendingIdempotencySnapshot(): StoredIdempotencySnapshot | null {
  try {
    const raw = getStorageItem(IDEMPOTENCY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
