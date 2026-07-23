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

## PHA 1.5 · DỌN CODE MẪU — 2026-07-23

### Kết quả
- **Chỉ MỘT lô có việc thật (lô 4 — demo dashboard+health, 11 file).** Các lô còn lại RỖNG có
  bằng chứng: knip BE 0 unused file; FE 6 unused file đều là GIỮ chủ đích (§4/NGỜ); lô 3 rỗng
  (FE chưa từng dựng letter/remit/legal); lô 6 rỗng (10 dep unused đều thuộc §4 — stellar-sdk,
  simplewebauthn, firebase-admin, redlock, hono/rpc, test infra); lô 7 rỗng (knip không thấy
  UI component chết); "script e2e chết" trong prompt không tồn tại (scan 04 tự xác nhận).
- Hồ sơ: `docs/ROUTES.md` (54 file FE + 46 id handoff, mỗi dòng Y/N v1) ·
  `docs/cleanup/{BASELINE,PHAN-LOAI}.md` + knip json.
- Sau dọn: 288 file .ts/.tsx (−11) · bundle 1134 KB / 73 precache (baseline 1178/77, −46 KiB)
  · FE unit 25 pass (baseline 26 − 1 khai báo) · BE nguyên 88 pass (không đụng be/).
- knip sau dọn: mục mới lộ (`lib/sse.ts`, `@testing-library/react`) → NGỜ/GIỮ có ghi trong
  PHAN-LOAI (nền SSE night-watch PHA 6 + khung test component).

### Smoke §8 (mức tối đa máy này cho phép)
- BE dev :3000 — /health + /ready OK; **đăng nhập THẬT** admin@example.com qua
  /api/auth/sign-in/email → token + get-session sống (curl, cookie jar).
- FE dev :5173 — trả SPA shell (title FamilyWallet, #root, main.tsx).
- **E2e/browser: FAIL-ENV** — chromium thiếu libnspr4/libnss3/libasound2, không sudo →
  UI click-through không chạy được local. LƯU Ý TRUNG THỰC: một lần chạy e2e trong phiên
  in ra danh sách test + exit 0 và bị đọc nhầm là "19/19 pass" — sai, exit 0 là của `tail`
  trong pipeline; đã đính chính trong commit lô 4 (amend). Verify thật ở CI (ci-fe.yml).

### Việc treo (không chặn PHA 2)
- Verify CI chạy trên GitHub Actions (máy không có `gh`) — cần xem tab Actions sau push.
- Máy dev: cài lib browser (cần sudo): `sudo pnpm --filter @repo/web exec playwright install-deps`
  hoặc apt libnspr4 libnss3 libasound2 → chạy lại e2e local.
- Landing `/` còn stack-card template (đã i18n, vô hại) — làm lại ở PHA 6 cùng redesign.

## PHA 2 · SPIKE PASSKEY — 2.1 + 2.2 xong (2026-07-23)

### 2.1 · Ba spike gate — GATE 3 (quyết định) PASS THẬT trên testnet
- `contracts/verifier-webauthn` (soroban-sdk 27.0.2, wasm 4.5KB): verifier secp256r1 kiểm
  rpIdHash pin + allow-list origin (K1) + challenge=prefix (K2, chống ký mù/replay) + UP/UV.
- Deploy testnet `CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP`; MỘT key ký 3 origin
  (web/apk/ext) → nhận cả 3 (3 tx thật); evil origin → Error(Contract,#5) OriginNotAllowed.
- **KẾT LUẬN: mô hình một-rpId-ba-origin đi tiếp, KHÔNG cần signer-riêng-từng-vỏ.**
- Trung thực: gate 1/2 (browser web→ext, web→APK) MÔ PHỎNG bằng p256 vì máy không chạy được
  browser (fail-env) + chưa có máy Android — TODO PHA 8/9. Chi tiết: SPIKE-PASSKEY.md.

### 2.2 · Verifier tích hợp OZ + smart account
- `contracts/origin-verifier` (SDK 26.1.1): bọc OZ `webauthn::verify` (audited) + chèn K1
  (rpIdHash + origin allow-list) mà OZ cố ý bỏ. Interface OZ `Verifier` trait → External signer.
- `contracts/smart-account`: ví contract mỗi hộ wrap OZ smart_account (signers/rules/policies),
  mở bằng WASM hash + constructor args (không hard-code contract ID).
- cargo test --workspace **15/15** (spike 8 + origin-verifier 4 + smart-account 3);
  stellar contract build 3 wasm. SDK pin =26.1.1 cho cụm OZ (0.7.2 chưa lên sdk 27); nâng khi OZ ra.

### Điểm resume PHA 2.3 (chưa làm)
- FE: smart-account-kit adapter + navigator.credentials + challenge = tx đã simulate (K2).
- BE: SEP-45 challenge/verify → JWT bind địa chỉ ví + device; P1-9 Bearer-first (cookie sameSite=lax
  chết trong WebView).
- Test: Playwright 1.61 virtual authenticator `context.credentials.install()` — CẦN browser
  (fail-env máy này: thiếu libnspr4/libnss3/libasound2, không sudo). Verify thật ở CI.
- CHẶN thực thi 2.3 trên máy hiện tại: browser e2e không chạy được local + smart-account-kit là
  npm package cần cài vào fe/ (đụng lockfile — làm khi vào 2.3 chính thức).
