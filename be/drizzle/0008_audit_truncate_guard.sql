-- B-SEC-4: 0002 chặn UPDATE/DELETE bằng trigger FOR EACH ROW, nhưng trigger DÒNG
-- KHÔNG BAO GIỜ bắn khi TRUNCATE → `TRUNCATE audit_log;` xoá sạch nhật ký mà trigger
-- vẫn nguyên. Thêm trigger STATEMENT-level cho TRUNCATE (dòng-level bị Postgres cấm
-- với TRUNCATE). Dùng lại hàm audit_log_append_only (TG_OP = 'TRUNCATE' → cùng thông
-- báo "append-only"). Forward-only: gỡ là một migration mới.
--
-- CÒN HỞ (ghi BLOCKERS): app connect bằng chính role SỞ HỮU bảng nên `DROP TRIGGER`
-- vẫn chạy được. Vá đủ cần tách role app xuống chỉ INSERT/SELECT trên audit_log —
-- đó là việc hạ tầng deploy, không phải migration.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
