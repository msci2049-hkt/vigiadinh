# SCAN-STATE — phiên 2026-07-26

Ghi sau mỗi pha. Phiên sau đọc file này rồi tiếp từ "VIỆC TIẾP THEO CHÍNH XÁC" ở cuối.

**Ba mức bằng chứng dùng trong file này:** `[CHẠY THẬT]` · `[HERMETIC]` (unit/mock, không
chạm mạng/DB thật) · `[CHƯA LÀM ĐƯỢC]`. Không gộp.

---

## Nhánh đang làm

`feat/fe-ui-assets` — origin/main + 6 commit FE (từ phiên trước) + 2 commit phiên này.
`main` local đang **behind origin/main 14** (không phải nhánh làm việc). `origin/main` = `0db71cd`.

---

## PHA 0 — ĐỒNG BỘ DRIFT · XONG

| Mục | Commit | Trạng thái |
|---|---|---|
| R2 gỡ khỏi env bắt buộc (B-ENV-1) | `659f66b` | ✅ |
| Dockerfile `--ignore-scripts` + deploy.sh owner URL + bun.lock name (B-INFRA-1) | `8889de0` | ✅ |

### Bằng chứng

- **gitleaks toàn history** `[CHẠY THẬT]` — gitleaks **8.30.1** (khớp pin CI
  `.github/workflows/secret-scan.yml:28`), `--log-opts="--all"`:
  **141 commit quét, `no leaks found`**. Điều này quét bù luôn cho `0db71cd` —
  commit từng push bằng `--no-verify`. **Lịch sử SẠCH.**
- **Pre-commit hook chặn THẬT** `[CHẠY THẬT]` — stage file chứa seed giả
  `S`+55 ký tự → `git commit` → lefthook v2.1.10 chạy gitleaks → `leaks found: 1`,
  `exit status 1`, commit **BỊ CHẶN**, HEAD không đổi. Probe đã xoá.
  Cả 2 commit phiên này đều qua hook thật (`✔️ gitleaks`), **KHÔNG dùng `--no-verify`**.
- **Test hồi quy đỏ trên bản cũ** `[CHẠY THẬT]` — `git stash` bản vá, giữ lại mỗi file test,
  chạy lại: **0 pass / 6 fail**. Dòng đỏ đầy đủ nằm trong commit message `8889de0`.
- **Gate** `[CHẠY THẬT]` — `bun run validate` xanh; `bun test` **295 pass / 0 fail / 9 skip**
  (trước phiên: 288 pass / 1 fail / 9 skip → +6 test mới, +1 test sửa).
- **env:check trên env production KHÔNG có R2_*** `[CHẠY THẬT]` — ✅ "đủ 7 biến bắt buộc".
- **`docker compose config`** trên `deploy/docker-compose.prod.yml` `[CHẠY THẬT]` — OK.

### CÃI PROMPT — 2 chỗ, prompt sai so với code thật

1. **§1.2 nói `lefthook.yml` root "comment 100%"** → **SAI**. Commit `357cd0a`
   ("fix(security): enforce pinned gitleaks pre-commit scan") đã sửa từ phiên trước:
   root `lefthook.yml` chạy `node scripts/run-gitleaks.mjs protect --staged`, script này
   **tự tải gitleaks 8.30.1** theo platform (có bảng `win32-x64`) → không còn phụ thuộc
   binary cài tay, tức nguyên nhân gốc của `--no-verify` **đã được sửa**, không phải chưa.
   Việc còn lại chỉ là *chứng minh nó chặn thật* — đã làm ở trên.
2. **§1.2 nói "chốt một chỗ, đừng để hai file mâu thuẫn"** → hai file **không** mâu thuẫn:
   root `lefthook.yml` (gitleaks, dùng bản tự tải) và `be/lefthook.yml` (biome + boundaries +
   gitleaks binary PATH) phục vụ 2 scope khác nhau. Chỉ hook ở **root** được git cài
   (`.git/hooks/pre-commit` → lefthook root). Để nguyên.

### 🔴 CHƯA LÀM ĐƯỢC — CI thật

**`[CHƯA LÀM ĐƯỢC]`** — không có `gh` CLI, không có token, `curl api.github.com/repos/
msci2026vn/family-wallet` trả **404** (repo private + không auth). Không có credential nào
trong môi trường này.

**KHÔNG viết "CI xanh".** Trạng thái CI trên `main` phiên này **chưa xác minh được** —
đúng như §1.3 cảnh báo là lỗi lặp 3 phiên. Gate local xanh là `[CHẠY THẬT]` nhưng
**local ≠ CI** (CI chạy matrix node 20/22/24, local chỉ có 22 — xem B-CI-3).

**Việc cho người thật:** mở tab Actions bằng mắt, hoặc `gh auth login` rồi
`gh run list --branch main --limit 5`.

### Việc TAY còn lại trên VPS (sau khi push)

1. `cp deploy/env.migrate.example deploy/.env.migrate` → điền `DATABASE_URL_OWNER`
   (password khớp `POSTGRES_PASSWORD`). **Không có file này thì deploy.sh dừng ngay** (fail-closed).
2. Xoá `DATABASE_URL_OWNER` khỏi `deploy/.env.production` (giờ đã tách).
3. Xoá 4 dòng `R2_*` khỏi `deploy/.env.production` → `up -d` (không cần `--build`).

---

---

## PHA 1 — SCAN BE · phần đã đóng

| Mục | Commit | Bằng chứng |
|---|---|---|
| §2.1 dispatcher thông báo | `f31f32d` | `[CHẠY THẬT]` mail vào Mailhog thật |
| §2.2 recovery-watch ồn ào | `f31f32d` | `[HERMETIC]` log WARN + cờ `/ready` |
| §2.5 R2 dead code | `659f66b` | `[CHẠY THẬT]` env:check ✅ không R2 |

### §2.1 — chuỗi veto ĐÃ NỐI LIỀN

Xác nhận chuỗi đứt trước khi vá: **4 producer** (`recovery-watch`, `presence-ping`,
`indexer.service`, `heartbeat.repository`) gọi `enqueueNotification*()`; **6 worker** đăng ký
trong `src/workers/index.ts`; **0 worker** đọc bảng `notifications`. `grep sendEmail src/`
→ đúng **1** caller không phải test: `auth.ts:210` (OTP đăng ký).

- Job mới: `be/src/jobs/notification-dispatch.ts` — cron 60s, claim lease atomic
  (`FOR UPDATE SKIP LOCKED`), backoff mũ 1'/2'/4'/8'/16', tối đa 5 lượt.
- Migration `0011` **add-only**: `attempts`/`claimed_at`/`sent_at`/`last_error` + index.
  Không DROP, không rename.
- **`[CHẠY THẬT]`** `notification-dispatch.integration.test.ts`: enqueue → tick → **mail nằm
  trong hộp thư Mailhog thật** (đọc lại qua HTTP API :44555, không phải mock) → tick lần hai
  KHÔNG gửi thêm. Log: `email.sent.dev subject:"Wallet recovery started"`.
- **Bug bắt được TRƯỚC khi ship:** `db.execute()` với sql thô trả row tên cột DB
  (snake_case), không phải field camelCase của Drizzle → `row.userId` **undefined im lặng**.
  Hỏng theo kiểu tệ nhất: `channel` trùng tên ở cả hai quy ước nên nhánh push *trông như đúng*,
  chỉ email gãy. Đã map tường minh qua `toClaimed()`.
- **Push CHƯA cấu hình, cố ý fail ồn ào:** `PUSH_NOT_CONFIGURED` + log ERROR + cờ `/ready`.
  → Kênh ngoài-app hiện **CHỈ có email**, chưa có dự phòng.

## PHA 2 — SCAN FE · phần đã đóng

| Mục | Commit | Bằng chứng |
|---|---|---|
| §3.1 rpId chốt + fail-closed | `98589ea` | `[HERMETIC]` tsc xanh; test logic verify ngoài vitest |

`VITE_PASSKEY_RP_ID` trước đây default `"localhost"` và **không có `.env.production`** →
build prod vẫn xanh, deploy xanh, mọi passkey gắn `localhost` và **chết vĩnh viễn** trên domain
thật. Nay `loadEnv()` **throw** khi build PROD còn `localhost`. Chốt
**`familyhaven.mscilabs.com`** (KHÔNG apex — apex cho mọi subdomain gọi passkey ví).

---

## 🔴 CHƯA LÀM ĐƯỢC / CÒN MỞ

| Mục | Trạng thái |
|---|---|
| **CI thật** | `[CHƯA LÀM ĐƯỢC]` — không `gh`, không token, API 404 (private). **KHÔNG đoán màu.** |
| **§2.3 SEP-45 footprint** | CHƯA LÀM — treo sang phiên sau |
| **§2.4 ví phí alarm + veto không cần fee-bump** | CHƯA LÀM — **mục nặng nhất còn lại** |
| **§2.6 nhãn guardian** | CHƯA LÀM |
| **§2.7 jwt_version / BOLA / pagination audit / bun audit** | CHƯA LÀM |
| **§3.2 stellar.toml** | CHƯA LÀM — B-FE-2, SEP-45 login không chạy nếu thiếu |
| **§3.3 §3.4 lằn ranh tiền + 41 màn** | CHƯA LÀM |
| **Gate FE** | `[CHƯA CHẠY ĐƯỢC]` — B-FE-1, node_modules là bản **Windows** |
| **recovery-watch đóng thật** | cần deploy contract testnet + `alerted > 0` |

---

## VIỆC TIẾP THEO CHÍNH XÁC

1. **Quyết định B-FE-1** (người): chạy tooling FE từ Windows, HAY cài lại deps trong WSL.
   Không quyết thì mọi gate FE còn mù.
2. **§2.4 ví phí** — mục nặng nhất còn mở: job alarm số dư + đường veto không phụ thuộc
   fee-bump. Đây là chuỗi mất ví duy nhất còn nguyên vẹn.
3. **§2.3 SEP-45 footprint** — chặn signing oracle.
4. **§3.2 `stellar.toml`** — B-FE-2.
