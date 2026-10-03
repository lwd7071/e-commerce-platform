-- T3 Hardening: Row-Level Security and Privilege Revocation on operational storage table
ALTER TABLE IF EXISTS api_idempotency_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE api_idempotency_records FROM anon, authenticated, PUBLIC;
