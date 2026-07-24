-- Custom migration (drizzle-kit generate --custom): audit_log APPEND-ONLY (A7,
-- PHA 3.4). REVOKE không đủ (app connect bằng owner của bảng) → trigger chặn
-- UPDATE/DELETE ở tầng Postgres — mọi role, mọi đường (kể cả psql tay).
-- Forward-only: gỡ trigger (nếu có lý do chính đáng) là MỘT migration mới.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (A7): % blocked', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
