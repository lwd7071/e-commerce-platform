import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { AdminNotificationCampaignService } from '../../../src/modules/moderation/services/admin-notification-campaign.service.ts';
import { ConflictError } from '../../../src/platform/errors/app-error.ts';

const campaignId = '00000000-0000-4000-8000-000000000001';

describe('Admin notification campaigns', () => {
  it('snapshots active recipients and replays the same campaign for an identical idempotency key', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let saved: { campaign_id: string; payload_fingerprint: string } | undefined;
    const progress = { campaign_id: campaignId, audience_role: 'BUYER', title: 'Sale', content: 'Message', status: 'PENDING', recipient_count: 2, delivered_count: 0, created_at: new Date('2026-10-02T00:00:00Z') };
    const client = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT campaign_id,payload_fingerprint')) return { rows: saved ? [saved] : [], rowCount: saved ? 1 : 0 };
        if (sql.includes('SELECT user_id FROM app_users')) return { rows: [{ user_id: 'buyer-1' }, { user_id: 'buyer-2' }], rowCount: 2 };
        if (sql.includes('INSERT INTO admin_notification_campaigns')) { saved = { campaign_id: String(params[0]), payload_fingerprint: String(params[7]) }; return { rows: [], rowCount: 1 }; }
        if (sql.includes('SELECT campaign_id,audience_role')) return { rows: [{ ...progress, campaign_id: saved?.campaign_id }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }, release() {},
    };
    const pool = { connect: async () => client } as unknown as Pool;
    const service = new AdminNotificationCampaignService(pool);
    const input = { audience_role: 'BUYER', title: 'Sale', content: 'Message', reason: 'Approved notice', idempotency_key: 'key-01' };
    const first = await service.create('admin-1', input);
    const replay = await service.create('admin-1', input);
    assert.equal(first.campaign_id, replay.campaign_id);
    assert.equal(first.recipient_count, 2);
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO admin_notification_campaign_recipients')).length, 2);
    assert.ok(calls.some(call => call.sql.includes('pg_advisory_xact_lock')));
    assert.ok(calls.some(call => call.sql.includes("role=$1 AND status='ACTIVE'")));
    await assert.rejects(() => service.create('admin-1', { ...input, content: 'Different payload' }), ConflictError);
  });

  it('sends a batch with a stable per-recipient event ID inside a transaction', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const client = { query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT r.campaign_id')) return { rows: [{ campaign_id: campaignId, user_id: 'buyer-1', title: 'Sale', content: 'Message' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }, release() {} };
    const service = new AdminNotificationCampaignService({ connect: async () => client } as unknown as Pool);
    assert.equal(await service.processBatch(10), 1);
    const insert = calls.find(call => call.sql.includes('INSERT INTO notifications'));
    assert.match(insert?.sql ?? '', /ON CONFLICT \(event_id\).*DO NOTHING/s);
    assert.equal(insert?.params[4], `ADMIN_CAMPAIGN:${campaignId}:buyer-1`);
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
  });
});
