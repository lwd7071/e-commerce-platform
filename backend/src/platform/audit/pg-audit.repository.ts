import { randomUUID } from 'node:crypto';
import type { IAuditPort, AdminAuditRecord } from '../../contracts/audit.port.ts';
import { ValidationFailedError } from '../errors/app-error.ts';

export const ALLOWED_AUDIT_TARGET_TYPES = ['USER', 'SHOP', 'PRODUCT', 'REVIEW'] as const;
export type AuditTargetType = typeof ALLOWED_AUDIT_TARGET_TYPES[number];

export interface QueryableClient {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export class PgAuditRepository implements IAuditPort {
  constructor(private readonly pool?: unknown) {}

  public async logAdminAction(trx: unknown, record: AdminAuditRecord): Promise<void> {
    if (!record.admin_id || typeof record.admin_id !== 'string' || record.admin_id.trim() === '') {
      throw new ValidationFailedError('admin_id is required for audit log');
    }

    if (!record.action || typeof record.action !== 'string' || record.action.trim() === '') {
      throw new ValidationFailedError('action is required for audit log');
    }

    const hasTargetType = record.target_type !== undefined && record.target_type !== null && record.target_type !== '';
    const hasTargetId = record.target_id !== undefined && record.target_id !== null && record.target_id !== '';

    // Enforce polymorphic pairing (RB-KN20): if one is provided, both must be provided
    if ((hasTargetType && !hasTargetId) || (!hasTargetType && hasTargetId)) {
      throw new ValidationFailedError('target_type and target_id must be provided together');
    }

    if (hasTargetType) {
      if (!ALLOWED_AUDIT_TARGET_TYPES.includes(record.target_type as AuditTargetType)) {
        throw new ValidationFailedError(
          `Invalid target_type '${record.target_type}'. Allowed types: ${ALLOWED_AUDIT_TARGET_TYPES.join(', ')}`
        );
      }
    }

    const client = (trx ?? this.pool) as QueryableClient;
    if (!client || typeof client.query !== 'function') {
      throw new Error('Database transaction client is required for audit logging');
    }

    const logId = randomUUID();
    const sql = `
      INSERT INTO admin_logs (log_id, admin_id, action, target_type, target_id, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()))
    `;

    const params = [
      logId,
      record.admin_id.trim(),
      record.action.trim(),
      hasTargetType ? record.target_type : null,
      hasTargetId ? record.target_id : null,
      record.reason ? record.reason.trim() : null,
      record.created_at || null
    ];

    await client.query(sql, params);
  }
}
