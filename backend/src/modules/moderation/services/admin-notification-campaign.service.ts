import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction } from '../../../../db/transaction.ts';
import { PgAuditRepository } from '../../../platform/audit/pg-audit.repository.ts';
import { ConflictError, NotFoundError, ReasonRequiredError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import { logger } from '../../../platform/logging/logger.ts';

type CreateCampaign = { audience_role: unknown; title: unknown; content: unknown; reason: unknown; idempotency_key: string };

export class AdminNotificationCampaignService {
  private readonly audit = new PgAuditRepository();
  constructor(private readonly pool: Pool) {}

  async preview(audienceRole: unknown) {
    if (audienceRole !== 'BUYER' && audienceRole !== 'SELLER') throw new ValidationFailedError('Audience must be BUYER or SELLER');
    const result = await this.pool.query<{ recipient_count: string }>("SELECT COUNT(*)::text AS recipient_count FROM app_users WHERE role=$1 AND status='ACTIVE'", [audienceRole]);
    return { audience_role: audienceRole, recipient_count: Number(result.rows[0]?.recipient_count ?? 0) };
  }

  startWorker(intervalMs = 1000, batchSize = 100): () => void {
    const timer = setInterval(() => {
      void this.processBatch(batchSize).catch(error => logger.error('Admin notification campaign batch failed', { error }));
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }

  async create(adminId: string, input: CreateCampaign) {
    if (input.audience_role !== 'BUYER' && input.audience_role !== 'SELLER') throw new ValidationFailedError('Audience must be BUYER or SELLER');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const content = typeof input.content === 'string' ? input.content.trim() : '';
    if (!title || title.length > 200 || !content) throw new ValidationFailedError('Campaign title and content are required');
    const idempotencyKey = input.idempotency_key.trim();
    if (!idempotencyKey || idempotencyKey.length > 100) throw new ValidationFailedError('Idempotency-Key must contain 1 to 100 characters');
    if (typeof input.reason !== 'string' || !input.reason.trim()) throw new ReasonRequiredError();
    const audience = input.audience_role;
    const reason = input.reason.trim();
    const fingerprint = createHash('sha256').update(JSON.stringify([audience, title, content, reason])).digest('hex');

    return withTransaction(this.pool, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`admin-campaign-v1:${adminId}:${idempotencyKey}`]);
      const existing = await client.query('SELECT campaign_id,payload_fingerprint FROM admin_notification_campaigns WHERE admin_id=$1 AND idempotency_key=$2 FOR UPDATE', [adminId, idempotencyKey]);
      if (existing.rows[0]) {
        if (existing.rows[0].payload_fingerprint !== fingerprint) throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used with a different campaign.');
        return this.getProgressWithClient(client, String(existing.rows[0].campaign_id));
      }
      const campaignId = randomUUID();
      const recipients = await client.query('SELECT user_id FROM app_users WHERE role=$1 AND status=\'ACTIVE\' ORDER BY user_id', [audience]);
      await client.query(
        `INSERT INTO admin_notification_campaigns (campaign_id,admin_id,audience_role,title,content,reason,idempotency_key,payload_fingerprint,recipient_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [campaignId, adminId, audience, title, content, reason, idempotencyKey, fingerprint, recipients.rows.length],
      );
      if (recipients.rows.length === 0) await client.query("UPDATE admin_notification_campaigns SET status='COMPLETED' WHERE campaign_id=$1", [campaignId]);
      for (const recipient of recipients.rows) await client.query('INSERT INTO admin_notification_campaign_recipients (campaign_id,user_id) VALUES ($1,$2)', [campaignId, recipient.user_id]);
      await this.audit.logAdminAction(client, { admin_id: adminId, action: 'CREATE_NOTIFICATION_CAMPAIGN', target_type: 'CAMPAIGN', target_id: campaignId, reason });
      return this.getProgressWithClient(client, campaignId);
    });
  }

  async getProgress(campaignId: string) {
    return withTransaction(this.pool, client => this.getProgressWithClient(client, campaignId), { readOnly: true });
  }

  async processBatch(batchSize = 100): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new ValidationFailedError('Batch size must be 1 to 500');
    return withTransaction(this.pool, async client => {
      const selected = await client.query(
        `SELECT r.campaign_id,r.user_id,c.title,c.content
           FROM admin_notification_campaign_recipients r
           JOIN admin_notification_campaigns c ON c.campaign_id=r.campaign_id
          WHERE r.status='PENDING' ORDER BY r.campaign_id,r.user_id
          LIMIT $1 FOR UPDATE OF r SKIP LOCKED`, [batchSize],
      );
      for (const recipient of selected.rows) {
        const eventId = `ADMIN_CAMPAIGN:${recipient.campaign_id}:${recipient.user_id}`;
        await client.query(
          `INSERT INTO notifications (notification_id,recipient_id,type,title,content,event_id)
           VALUES ($1,$2,'SYSTEM',$3,$4,$5) ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING`,
          [randomUUID(), recipient.user_id, recipient.title, recipient.content, eventId],
        );
        await client.query(`UPDATE admin_notification_campaign_recipients SET status='SENT',sent_at=now() WHERE campaign_id=$1 AND user_id=$2 AND status='PENDING'`, [recipient.campaign_id, recipient.user_id]);
      }
      const campaignIds = [...new Set(selected.rows.map(row => String(row.campaign_id)))];
      for (const campaignId of campaignIds) {
        await client.query(
          `UPDATE admin_notification_campaigns c SET delivered_count=(SELECT COUNT(*) FROM admin_notification_campaign_recipients r WHERE r.campaign_id=c.campaign_id AND r.status='SENT'),
                  status=CASE WHEN EXISTS (SELECT 1 FROM admin_notification_campaign_recipients r WHERE r.campaign_id=c.campaign_id AND r.status='PENDING') THEN 'PROCESSING' ELSE 'COMPLETED' END,
                  updated_at=now() WHERE c.campaign_id=$1`, [campaignId],
        );
      }
      return selected.rows.length;
    });
  }

  private async getProgressWithClient(client: { query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> }, campaignId: string) {
    const result = await client.query(
      `SELECT campaign_id,audience_role,title,content,status,recipient_count,delivered_count,created_at
         FROM admin_notification_campaigns WHERE campaign_id=$1`, [campaignId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError('Notification campaign was not found');
    return { campaign_id: String(row.campaign_id), audience_role: String(row.audience_role), title: String(row.title), content: String(row.content), status: String(row.status), recipient_count: Number(row.recipient_count), delivered_count: Number(row.delivered_count), created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) };
  }
}
