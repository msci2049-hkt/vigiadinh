# TEMPLATE-DEVIATIONS — chỗ tài liệu/skill nói SAI so với code (BE)

> Nguyên tắc: tài liệu mâu thuẫn code → TIN CODE, ghi vào đây. Cập nhật 2026-07-20 (bootstrap FamilyWallet).

## 1. Rule/skill lạc hậu đã SỬA trong repo này

| Chỗ sai | Thực tế code | Đã xử lý |
|---|---|---|
| `.claude/rules/auth.md` §"Mount order" vẽ `CORS → auth.handler → session` | `src/app.ts` thật: `cors → secureHeaders → csrf(/api/*) → requestId → logger → hashGuard(/api/auth/*) → auth.handler → session → /health /ready → routes → onError`. Làm theo rule cũ là gỡ hardening khỏi `/api/auth/*` | Viết lại sơ đồ + checklist trong rule (2026-07-20) |
| `.claude/rules/db-schema.md` ví dụ `.references(() => users.id)` | Không có bảng `users` nghiệp vụ; bảng `user` Better Auth id `text`, template PK ULID `varchar(26)` — không FK cứng được | Viết lại: soft ref `varchar("user_id",{length:64})` + index bắt buộc; FK cứng chỉ giữa bảng tự viết; `audit_logs.actorId` → `varchar(64)` |
| Skill `fw-bootstrap-monorepo` nói `.env.example` có `TRUSTED_ORIGINS=http://localhost:3000` (sai, cần sửa) | `.env.example` hiện tại ĐÃ là `http://localhost:5173,http://localhost:5174` kèm comment — template đã tự sửa sau khi skill được viết | KHÔNG sửa gì — skill lạc hậu, code đúng sẵn |
| `familywallet-project-config/CLAUDE.md` mô tả MONOREPO bun workspaces (`contracts/`, `apps/api`, `apps/web`, `packages/shared`) | Quyết định hiện tại: **2 repo độc lập** (`stellaer-be` + `stellar-fe-vite`), nói chuyện qua HTTP; types chung qua `src/shared-contract/` + `docs/CONTRACT-SYNC.md`, không package chung | CLAUDE.md của cả 2 repo viết lại bản đồ 2-repo khi overlay |

## 2. Deviation so với PROMPT bootstrap (tự quyết — cần user xác nhận)

| Chỉ dẫn | Thực tế phát hiện | Quyết định |
|---|---|---|
| "Xóa `src/lib/pool-budget.ts` + `pool-budget.test.ts`" | pool-budget KHÔNG phải lớp demo carbon — là guard **connection budget lõi** (refuse boot khi `(WEB_INSTANCES+1)×DB_POOL_MAX` > 80% `PG_MAX_CONNECTIONS`), được `src/index.ts` + `src/cluster.ts` import. Xóa là gãy boot + mất hardening | **GIỮ LẠI** (đã lỡ xóa rồi khôi phục từ git). Nếu vẫn muốn bỏ phải gỡ cả call sites — chờ user xác nhận |
| "node scripts/init-project.mjs familywallet-api --no-install" | Script có guard `die()` khi remote origin là template repo (đúng tình trạng hiện tại), và mặc định RESET GIT (mất lịch sử + backup branch) | Tạm rename `origin`→`template` để qua guard, chạy kèm `--no-git` (giữ nguyên lịch sử), rename lại. Remote không đổi |
| "cp .env.example .env" (bước 1.4) | `.env` cũ tồn tại từ trước với giá trị nguy hiểm (`COMPOSE_PROJECT_NAME=mau-demo-dev` — đè stack docker template; port 5432 — bẫy BUG-012; thiếu key mới) | Backup `.env` cũ ra scratchpad, để init-project sinh `.env` MỚI (secret mới, slug `familywallet-api`, port rảnh DB=43339/Redis=44397/Mailhog=44271+44555) |

## 3. Ghi nhận, CHƯA làm (đúng kế hoạch)

- **Cron ping 12:00**: template CHƯA có repeatable job (`redlock.ts` mồ côi — không file nào import;
  2 job cũ của demo đều theo sự kiện và đã xóa cùng `src/jobs/`). Dựng sau theo skill `new-cron`;
  tên queue BẮT BUỘC có `{ngoặc nhọn}`.
- **Webhook**: `services/webhooks/verify.ts` + `middlewares/raw-body.ts` tồn tại nhưng KHÔNG route nào
  gọi, không bảng `webhook_events` — chưa nối dây, đừng tưởng có sẵn.
- **Tính năng két di chúc (will vault) ĐÃ HỦY** — skill `fw-will-vault` còn trên đĩa nhưng không dựng theo.
