-- T3 cross-domain hardening: durable notification event idempotency.
-- Nullable keeps existing/manual notifications compatible; domain-event notifications supply event_id.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications__event_id
  ON notifications(event_id)
  WHERE event_id IS NOT NULL;
