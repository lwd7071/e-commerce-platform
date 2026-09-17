export interface AdminAuditRecord {
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at?: string;
}

export interface IAuditPort {
  /**
   * Logs admin action atomically within the given database transaction.
   * Mandated by error-observability.md Mục 6 and business-rules.md QD20.
   */
  logAdminAction(trx: unknown, record: AdminAuditRecord): Promise<void>;
}
