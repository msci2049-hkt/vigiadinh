-- B-SEC-4 (đóng nốt) — TÁCH ROLE, phòng tuyến THẬT của nhật ký append-only.
--
-- Vì sao trigger chưa đủ (0002 + 0008 đã có): app connect bằng chính role SỞ HỮU
-- bảng, và chủ sở hữu thì `DROP TRIGGER audit_log_no_truncate` rồi `TRUNCATE` được
-- trong hai câu lệnh. Trigger chặn TAY NGƯỜI DÙNG NHẦM; nó không chặn kẻ đã chiếm
-- được quyền ghi DB (kịch bản đỏ #2). Phòng tuyến thật là quyền ở tầng ROLE: role
-- chạy runtime KHÔNG có DDL và KHÔNG có UPDATE/DELETE/TRUNCATE trên audit_log, nên
-- không có câu lệnh nào để gỡ trigger ngay từ đầu.
--
-- Vì sao role này NOLOGIN: migration không được chứa mật khẩu (nó nằm trong git).
-- Đây là role NHÓM mang đúng bộ quyền; bước deploy tạo user đăng nhập thật rồi
-- `GRANT app_runtime TO <user>`. Xem docs/DEPLOY.md mục "role runtime".
-- Forward-only: đổi quyền là một migration mới.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
-- Quyền nền: đọc/ghi nghiệp vụ bình thường trên MỌI bảng trong public.
GRANT USAGE ON SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
-- Bảng sinh ra SAU migration này cũng phải theo cùng luật, nếu không thì mỗi lần
-- thêm bảng là một lỗ mới mà không ai nhớ.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
--> statement-breakpoint
-- NGOẠI LỆ audit_log: chỉ ĐỌC và THÊM. Thu hồi cả ba đường xoá/sửa, và thu hồi
-- khỏi PUBLIC nữa — PUBLIC là role ngầm mà MỌI role kế thừa, bỏ sót nó là bỏ ngỏ.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_runtime;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO app_runtime;
--> statement-breakpoint
-- Chốt hạ: role runtime không sở hữu gì trong schema này, nên không có
-- `DROP TRIGGER`/`ALTER TABLE`/`DROP TABLE` nào chạy được — Postgres gắn quyền DDL
-- với QUYỀN SỞ HỮU, không phải với một GRANT rời. Vì vậy "không cấp sở hữu" là đủ,
-- MIỄN LÀ migration được chạy bằng role owner KHÁC (không phải app_runtime).
-- Hai câu dưới lấy lại quyền tạo bảng nếu ai đó từng cấp trên schema.
REVOKE CREATE ON SCHEMA public FROM app_runtime;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
