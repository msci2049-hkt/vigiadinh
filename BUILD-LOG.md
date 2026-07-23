# BUILD-LOG — family-wallet

> Nhật ký marathon build theo `../CHECKLIST-BUILD-vigiadinh.md`. Mỗi pha: bước xong,
> bằng chứng test, commit, điểm resume kế tiếp.

## PHA 1 · GỘP GIT + KHUNG SẠCH — 2026-07-23

### 1.1 Khởi tạo repo đơn ✅
- `git init -b main` + `.gitignore` (chặn .env*, keys.json, *.pem/*.key) là commit đầu (`4e6a7f2`).
- Remote: `git@github-msci:msci2026vn/family-wallet.git` — dùng dạng SSH (alias `github-msci`)
  thay vì https trong checklist vì máy này chỉ có SSH credential (https không có helper).
  Repo GitHub đã tồn tại (rỗng) — `git ls-remote` OK.

### 1.2 Subtree nhập BE + FE giữ lịch sử ✅
- `git subtree add --prefix=be ../stellaer-be chore/skill-library` + tương tự `fe`, KHÔNG --squash.
- Bằng chứng lịch sử đầy đủ: `git rev-list --count HEAD` = **121** (1 gitignore + 70 BE + 48 FE + 2 merge);
  tip BE `19e44df` và tip FE `06320e6` đều là ancestor của HEAD (`git merge-base --is-ancestor` OK).
- Lưu ý: `git log --oneline -- be/ | wc -l` chỉ ra 1 vì các commit lịch sử chạm path gốc repo cũ
  (chưa có prefix) — dùng rev-list + ancestor làm bằng chứng thay. Khôi phục file cũ:
  `git checkout <sha> -- <path-gốc-cũ>` hoặc đọc từ tip subtree.

### 1.3 Kiểm khung chạy được ✅ (không đụng lockfile)
- `.env` không được subtree mang theo (untracked ở repo cũ) → copy tay từ `../stellaer-be/.env`
  và `../stellar-fe-vite/apps/web/.env`; xác nhận `git status` sạch (gitignore chặn đúng).
- BE: `bun install --frozen-lockfile` + `bun run validate` xanh + `bun test` → **88 pass, 3 skip, 0 fail** (khớp báo cáo cũ).
- FE: `pnpm i --frozen-lockfile` + `pnpm test` → **core 14/14 + web 9/9 pass** (3/3 task turbo).
- **Fail-env KI-5 (WSL /mnt/d) tái hiện + workaround cục bộ:** vitest 4.1.9 worker không khởi động
  kịp `START_TIMEOUT` 60s (hằng số cứng) vì I/O 9p/NTFS — đo được `require('jsdom')` mất 4m23 lạnh,
  3m37 "ấm". Đã vá TẠI CHỖ `node_modules/.pnpm/vitest@4.1.9*/…/cli-api.24X8XwN1.js`:
  `START_TIMEOUT 6e4→6e5`, `WORKER_START_TIMEOUT 9e4→6e5`. Vá này nằm ngoài git (node_modules),
  mất sau mỗi lần `pnpm i` → nếu test lại timeout hàng loạt thì vá lại. CI (Linux FS) không cần.
- FE e2e (playwright) CHƯA chạy lại sau merge — sẽ chạy ở gate PHA 1.5 (smoke); báo cáo cũ 20/20.
- Lefthook: `lefthook install` (prepare script) sinh stub `lefthook.yml` ở root vì git root đổi —
  đã xoá stub; hook per-repo (be/lefthook.yml, fe/lefthook.yml) hiện KHÔNG tự chạy qua git hook
  root. TODO: root lefthook.yml gọi vào be/fe (ghi BLOCKERS nếu cần trước khi có CI).

### 1.4 shared/ + CLAUDE.md gốc + sửa 3 tài liệu lệch ✅
- `shared/contract.ts` (5 enum trạng thái, dependency-free) + `shared/intent.ts` (13 intent state
  theo handoff §03 + 3 policy decision + 9 reason code).
- Root `package.json` CHỈ script: `sync:contract` (copy AUTO-SYNC vào `be/src/shared-contract/` +
  `fe/packages/core/src/contract/`) + `check:contract` (hash chuẩn hoá — cùng thuật toán contract-check).
- `be/src/shared-contract/enums.ts` refactor: zod enum derive từ `./contract` (một nguồn).
- Root `CLAUDE.md`: bản đồ be/fe/contracts/shared + luật "git chung, build riêng, cấm import chéo".
- Sửa lệch: be/CLAUDE.md + fe/CLAUDE.md (bỏ "2 REPO ĐỘC LẬP" → bản đồ monorepo),
  CONTRACT-SYNC.md (2 bản giống hệt, thêm §3b quy trình shared/), header ONCHAIN-EVENTS.md
  (đường dẫn vigiadinh-main là repo cũ ngoài monorepo).
- Bằng chứng: `bun run sync:contract` + `bun run check:contract` xanh; BE validate + 88 test xanh;
  FE validate xanh (log task b9hg72k5n).

### Điểm resume
- Kế tiếp: 1.5 CI 3 job lọc path + secret-scan → commit + push → GATE PHA 1 (grep seed) → PHA 1.5 (dọn code mẫu).
