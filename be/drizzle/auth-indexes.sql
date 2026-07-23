-- WHY: 9 index bổ sung tối ưu auth path (login, session lookup, cleanup).
-- Column tên snake_case (theo schema do CLI sinh). Index nào trùng với
-- index đã có từ schema (session_userId_idx, account_userId_idx,
-- verification_identifier_idx) hoặc UNIQUE auto-index (user.email,
-- session.token) sẽ IF NOT EXISTS no-op — chạy lại idempotent.
--
-- Áp dụng:
--   docker compose exec postgres psql -U app -d app < drizzle/auth-indexes.sql

-- Session table (truy vấn nhiều nhất)
CREATE INDEX IF NOT EXISTS idx_session_user_id    ON "session" (user_id);
CREATE INDEX IF NOT EXISTS idx_session_token      ON "session" (token);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON "session" (expires_at);
CREATE INDEX IF NOT EXISTS idx_session_user_expires ON "session" (user_id, expires_at);

-- Account table (OAuth providers)
CREATE INDEX IF NOT EXISTS idx_account_user_id  ON account (user_id);
CREATE INDEX IF NOT EXISTS idx_account_provider ON account (provider_id);

-- User table
CREATE INDEX IF NOT EXISTS idx_user_email ON "user" (email);

-- Verification table (email verify + reset password token)
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification (identifier);
CREATE INDEX IF NOT EXISTS idx_verification_expires_at ON verification (expires_at);
