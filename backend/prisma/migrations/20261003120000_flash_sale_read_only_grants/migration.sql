REVOKE ALL ON TABLE flash_sale_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE flash_sale_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE flash_sale_compensation_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE flash_sale_sessions TO anon, authenticated;
GRANT SELECT ON TABLE flash_sale_items TO anon, authenticated;
