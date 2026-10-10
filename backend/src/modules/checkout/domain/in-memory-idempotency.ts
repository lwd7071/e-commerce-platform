import type {
  IdempotencyPort,
  IdempotencyScope,
  IdempotencyClaim,
} from '../contracts/idempotency.port.ts';

interface StoredIdempotencyEntry<T> {
  scope: IdempotencyScope;
  fingerprint: string;
  ownershipToken: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  result?: T;
  expiresAt?: string;
  createdAt: number;
}

export class InMemoryIdempotencyAdapter<T> implements IdempotencyPort<T> {
  private entries = new Map<string, StoredIdempotencyEntry<T>>();

  private toKey(scope: IdempotencyScope): string {
    return `${scope.user_id}:${scope.endpoint}:${scope.key}`;
  }

  public async claim(scope: IdempotencyScope, fingerprint: string): Promise<IdempotencyClaim<T>> {
    const key = this.toKey(scope);
    const existing = this.entries.get(key);

    if (existing) {
      if (existing.status === 'COMPLETED') {
        if (existing.fingerprint !== fingerprint) {
          return { kind: 'conflict' };
        }
        return { kind: 'replay', result: existing.result as T };
      }

      if (existing.status === 'IN_PROGRESS') {
        // If timed out (e.g. 2 minutes), could be reclaimed, else in_progress
        const now = Date.now();
        if (now - existing.createdAt < 120_000) {
          return { kind: 'in_progress' };
        }
      }
    }

    const ownershipToken = crypto.randomUUID();
    this.entries.set(key, {
      scope,
      fingerprint,
      ownershipToken,
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
    });

    return { kind: 'acquired', ownership_token: ownershipToken };
  }

  public async complete(
    scope: IdempotencyScope,
    ownershipToken: string,
    result: T,
    expiresAt: string,
  ): Promise<void> {
    const key = this.toKey(scope);
    const existing = this.entries.get(key);
    if (!existing || existing.ownershipToken !== ownershipToken) {
      return;
    }
    existing.status = 'COMPLETED';
    existing.result = result;
    existing.expiresAt = expiresAt;
  }

  public async release(scope: IdempotencyScope, ownershipToken: string): Promise<void> {
    const key = this.toKey(scope);
    const existing = this.entries.get(key);
    if (existing && existing.ownershipToken === ownershipToken && existing.status === 'IN_PROGRESS') {
      this.entries.delete(key);
    }
  }

  public clear(): void {
    this.entries.clear();
  }
}
