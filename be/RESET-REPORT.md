# RESET-REPORT — stellaer-be

## PHẦN 0 — Kiểm tra an toàn (2026-07-20, TRƯỚC khi sửa)

1. **Commit chưa push / stash:** KHÔNG có. `git log --branches --not --remotes` = 0;
   nhánh hiện tại `chore/skill-library` (f413a8e) chưa có upstream nhưng commit đã nằm trên remote ref.
   `main` đang checkout ở linked worktree `D:/du-an/du-an-mau/be-hardening` (stale) — không checkout main tại đây.
2. **File M:** 0. File D: 0. → restore/clean an toàn tuyệt đối.
3. (Câu hỏi FE — không áp dụng.)
4. **`.claude/skills/familywallet-project-config/` CÓ tồn tại** (zip giải nén nhầm chỗ) + 10 thư mục
   `skill-fw-*`/`stellar-mainnet-deploy` lồng sai. Nguồn: `tai-lieu/skill/*.zip`.
   Không tồn tại file tên `config-familywallet-be.zip` — user OK dùng bộ `familywallet-project-config`
   cho cả 2 repo. CLAUDE.md trong đó viết cho monorepo → đã viết lại bản đồ 2-repo khi overlay.

Remote origin = repo template `git@github-msci:msci2026vn/code-base-mau-be-chuan-cho-cac-du-an.git` — CHƯA push gì.

## PHẦN 1.1 — Reset + overlay config (đã xong)

- Nhánh backup: `backup/truoc-sua-20260720`.
- `git restore . && git clean -fd` → status TRỐNG. 11 thư mục untracked (config nhầm chỗ) đã xóa,
  nội dung backup ở scratchpad + zip gốc còn nguyên trong `tai-lieu/skill/`.
- Overlay: `CLAUDE.md` (viết lại bản đồ 2-repo, KHÔNG monorepo), `docs/PROJECT-BRIEF.md`,
  `docs/REBUILD-CHECKLIST.md`, `.claude/rules/{security,stellar,code-style}.md` (thêm — 9 rule gốc giữ nguyên),
  `.claude/agents/{e2e-verifier,security-reviewer,soroban-auditor,ux-writer}.md` (thêm — 5 agent gốc giữ),
  `.claude/skills/fw-*` (8) + `stellar-mainnet-deploy`.
- Tự quyết: CLAUDE.md template cũ giữ lại ở `docs/TEMPLATE-PRIMER-BE.md` (bản đồ template chi tiết,
  BUG-001…014, deploy runbook — vẫn là tài liệu sống cho nền BE).

## PHẦN 1.2–1.3 (đã xong, commit 5c0b6f6 + 07ef04d)

- init-project xóa 45 file demo + strip 12 file wiring + reset drizzle; xóa thêm `auth.ts.before-upgrade`.
- **GIỮ `src/lib/pool-budget.ts` + test** (prompt bảo xóa nhưng nó là guard connection-budget LÕI,
  được index.ts + cluster.ts import — xem TEMPLATE-DEVIATIONS §2, chờ user xác nhận).
- ERRORS.md ×2 cắt BUG-001…014, giữ bảng pattern; GIOI-THIEU/CODE_BASE_MAP/README hết nhắc carbon.
- `bun run validate` XANH; `bun test` 71 pass / 7 skip / 0 fail (skip = trước khi bật Docker).
- Sửa 2 rule sai (auth.md mount order, db-schema.md soft ref) + `.gitleaks.toml` thêm cú pháp
  `[allowlist]` số ít (8.24.3 bỏ qua im lặng `[[allowlists]]` — allowlist template trước giờ không chạy).
- `.env` cũ stale (COMPOSE_PROJECT_NAME=mau-demo-dev, port 5432) → backup scratchpad, sinh mới:
  slug `familywallet-api`, secret mới, port DB=43339 / Redis=44397 / Mailhog=44271+44555.

## Bằng chứng chạy thật (PHẦN 1.4 — 2026-07-20 11:55)

- [x] `bun run env:check` — đủ 11 biến bắt buộc.
- [x] `docker compose up -d` (không kèm tên service) → 3 container `familywallet-api-{postgres,dragonfly,mailhog}` healthy.
- [x] `bun run auth:generate` + `db:generate` → `drizzle/0000_wild_squirrel_girl.sql` (5 bảng:
  products + user/session/account/verification) + `db:migrate` áp OK + `seed:admin`.
- [x] `/health` → HTTP 200 `{"ok":true}`.
- [x] `/ready` → HTTP 200 `{"ok":true}` (Postgres + Dragonfly).
- [x] Login `admin@example.com` qua curl (Origin 5173) → HTTP 200, cookie session, `role:"admin"`;
  `get-session` trả session hợp lệ.
- [x] SSE `GET /api/events` (cookie) → nhận `event: connected` + `event: ping`.
- [x] `bun add @stellar/stellar-sdk@^16 firebase-admin @simplewebauthn/server` (bun chặn 2 postinstall
  protobufjs/@firebase-util theo default trust — để nguyên, chưa cần).
- [x] **Login THẬT từ trình duyệt (PHẦN 3.2)** — Chromium thật (Playwright, KHÔNG mock) vào FE
  dev `:5173` → BE `:3000`. **8/9 check PASS** (`apps/web/scripts/verify-real-login.mjs` bên FE):
  `POST /api/auth/sign-in/email` → 200 · cookie **`familywallet-api.session_token`** được set
  (chứng minh `COOKIE_PREFIX`=slug + `TRUSTED_ORIGINS` + CORS credentials đúng) · redirect
  `/login` → `/admin` (role admin từ seed) · vào được `/dashboard` + `/admin` (guard 2 tầng) ·
  `GET /api/events` (SSE) 200 từ trình duyệt · `admin/list-users` 200 (admin plugin chạy thật) ·
  `/welcome` render i18n. **1 check đỏ có lý do**: console báo `404 /api/dashboard/summary` —
  FE còn màn DEMO `/dashboard` của template gọi endpoint BE chưa từng tồn tại (xem mục dưới).

## PHẦN 1.5 — Khung 8 module (2026-07-20)

- 8 module nhân khuôn `modules/product` (Vertical Slice): `wallets` `guardians` `presence`
  `recovery` `inheritance` `indexer` `notifications` `risk` — 81 file (routes/domain/infra/features
  + dto/handler/handler.test stub hermetic).
- Schema đúng luật: PK ULID `varchar(26)` · user = SOFT REF `varchar(64)`+index · FK cứng chỉ giữa
  bảng tự viết (onDelete + index) · CHECK thay enum (9 CHECK). `risk` không bảng riêng (score ghi
  vào `recovery_requests` — đúng spec).
- Ownership scoping NGAY TỪ KHUNG: mọi list guardian/ping/recovery/heir/audit JOIN `wallets`
  assert `wallets.user_id = user hiện tại` (luật "trạng thái guardian chỉ chủ ví thấy").
- FK xuyên module: schema file import TƯƠNG ĐỐI schema module khác — ngoại lệ có chủ đích cho
  tầng schema (tiền lệ: `db/schema/index.ts` của template), comment tại chỗ.
- Migration reset lần cuối (ngoại lệ bootstrap, DB chưa có dữ liệu thật): `drizzle/0000_init.sql`
  = 14 bảng (9 FamilyWallet + products + 4 auth) + 9 CHECK. `docker compose down -v` → DB TRẮNG →
  migrate OK 1.28s → seed:admin lại.
- `bun run validate` XANH · `bun test` **88 pass / 3 skip / 0 fail** (3 skip = realtime
  cross-process cần RUN_REALTIME_IT=1; test tích hợp product chạy THẬT trên Postgres).
- Smoke: `/api/wallets` không auth → 401; có auth → 200 `{"data":[]}`; `/api/risk` → 200.
- Ghi nhận CHƯA làm (đúng kế hoạch): cron ping 12:00 (template chưa có repeatable — skill
  new-cron, queue name `{ngoặc nhọn}`); indexer checkpoint getEvents; FCM/APNs push.

## PHẦN 3 — Nối hai bên (2026-07-20)

### 3.1 Hợp đồng BE↔FE

- `src/lib/access-control.ts` (BE) và `packages/auth/src/access-control.ts` (FE): diff phần khai
  báo (bỏ comment) = **KHỚP 100%**, KHÔNG sửa gì (đúng chỉ dẫn).
- **`contract:check` mới** ở cả hai repo (`scripts/contract-check.ts` / `.mjs`), nằm trong
  `validate` → CI đỏ nếu lệch. Cách làm: chuẩn hóa file (bỏ dòng comment/trống, cắt trailing
  space) → SHA-256 → so với `canonical-hash` trong `docs/CONTRACT-SYNC.md`. Hai repo dùng CÙNG
  thuật toán nên ra CÙNG một hash → phát hiện được cả khi chỉ một bên đổi.
  Hash hiện tại: `7dead00016727b102f17f3f452a8b0a7cc05494d54c5807905688845e24b453e`.
- **`src/shared-contract/`** (BE là nguồn): `enums.ts` (guardian status, device kind, recovery
  status, notification status/channel — mirror CHECK constraint), `api-envelope.ts`, `sse.ts`.
  Module validators nay RE-EXPORT từ đây thay vì tự khai → 1 nguồn duy nhất trong BE.
- `docs/CONTRACT-SYNC.md` **giống hệt ở cả hai repo**, có luật "thêm role = sửa CẢ HAI repo trong
  cùng một đợt" + bảng sync log.
- Env khớp: FE `VITE_API_URL` == BE `BETTER_AUTH_URL` == `http://localhost:3000`;
  BE `TRUSTED_ORIGINS` = `http://localhost:5173,http://localhost:5174` ⊇ origin FE.

### 3.3 Hiện trạng `vigiadinh-main` (CHỈ BÁO CÁO — không sửa gì trong đó)

Cấu trúc lồng 1 lớp: `vigiadinh-main/vigiadinh-main/`.

| Mục | Hiện trạng |
|---|---|
| `contracts/recovery-registry/` | 209 KB — `src/lib.rs` + `src/test.rs` + Cargo.toml/lock + Makefile + rust-toolchain + **12 test_snapshots** (happy_path_full_recovery, finalize_fails_before_timelock, owner_cancel_voids_request, guardian_cannot_double_approve, …). Đây là thứ đáng giữ nhất. |
| `scripts/` | 38 MB (gồm `node_modules/`) — 13 file: config.mjs, demo.sh, demo-veto.sh, fund-friendbot.mjs, gen-keys.mjs, setoptions.mjs, setup-multisig.mjs, submit-recovery.mjs, verify-account.mjs, verify-setoptions-offline.mjs + `keys.json` |
| `frontend/` | 103 MB — **KHÔNG copy** (FE mẫu hơn hẳn: đã có auth, admin panel, i18n, honest build, test) |
| Git | **KHÔNG phải git repo** — không có `.git`. Không có lịch sử để giữ. |
| LICENSE | **KHÔNG có** |

🔴 **`scripts/keys.json` chứa 5 secret seed Stellar** (field `"secret"`). Khi tách repo contract:
**loại file này ra**, thêm vào `.gitignore`, và coi 5 khóa đó là **đã lộ** (chúng nằm trên đĩa
không mã hóa) — nếu từng dùng trên testnet thì bỏ luôn, tuyệt đối không tái dùng ở mainnet.
Rule `stellar-secret-seed` vừa thêm vào `.gitleaks.toml` của cả hai repo sẽ chặn nếu ai lỡ commit.

**Chưa làm gì với `vigiadinh-main`** — chờ mày quyết (tách repo contract riêng hay giữ nguyên nó
làm repo contract). Việc kèm theo khi quyết: `git init` + LICENSE + đưa CONTRACT_ID vào README.
