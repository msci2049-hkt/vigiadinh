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

## VIỆC TIẾP THEO CHÍNH XÁC

§2.1 — dispatcher thông báo (mục #2 trong bảng thứ tự §4). Đang điều tra chuỗi đứt:
`recovery-watch` → `enqueueNotification()` → INSERT bảng `notifications` → **hết**.
Cần xác nhận không consumer nào đọc bảng đó rồi viết job dispatcher.
