/** Proposal only. The storage adapter and transaction binding require owners 1/2 approval. */
export interface IdempotencyScope {
  readonly user_id: string;
  readonly endpoint: string;
  readonly key: string;
}

export type IdempotencyClaim<T> =
  | { readonly kind: 'acquired'; readonly ownership_token: string }
  | { readonly kind: 'replay'; readonly result: T }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'in_progress' };

export interface IdempotencyPort<T> {
  /** Atomic scope+fingerprint comparison; no separate read-then-insert claim. */
  claim(scope: IdempotencyScope, fingerprint: string): Promise<IdempotencyClaim<T>>;
  /**
   * Must participate in the SAME transaction as Order writes and Cart cleanup.
   * Persist business result (not the old request_id). Retain at least 24h.
   * Token comparison must prevent a stale worker from completing another claim.
   */
  complete(scope: IdempotencyScope, ownershipToken: string, result: T, expiresAt: string): Promise<void>;
  /** After rollback only; compare ownership token, never remove a completed result. */
  release(scope: IdempotencyScope, ownershipToken: string): Promise<void>;
}
