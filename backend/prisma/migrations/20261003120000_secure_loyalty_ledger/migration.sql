-- Migration: 20261003120000_secure_loyalty_ledger
-- Forward-only migration to enable RLS and revoke direct access to loyalty ledger from anon/authenticated roles

ALTER TABLE loyalty_point_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE loyalty_point_transactions FROM PUBLIC, anon, authenticated;
