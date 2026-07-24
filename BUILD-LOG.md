# BUILD-LOG — family-wallet

> Nhật ký marathon build theo `../CHECKLIST-BUILD-vigiadinh.md`. Mỗi pha: bước xong,
> bằng chứng test, commit, điểm resume kế tiếp.

> ⚠️ **MỌI SHA ghi trước 2026-07-24 trong file này KHÔNG CÒN HIỆU LỰC.** Lịch sử đã được
> rewrite ngày 2026-07-23: toàn bộ lịch sử scaffold nhập từ template bị gộp thành MỘT commit
> gốc `chore: nền dự án family-wallet — BE + FE`, 15 commit việc thật được rebase lên trên
> (136 commit → 16). Cây làm việc KHÔNG đổi một byte nào (tree SHA `9585b42` trước và sau
> giống hệt). Nội dung từng mục dưới vẫn đúng — chỉ con số SHA là tra không ra.
> Lịch sử cũ (đủ 136 commit, đỉnh `182c698`) KHÔNG còn nhánh nào trong repo — repo chỉ còn `main`.
> Bản sao nằm NGOÀI repo: `../family-wallet-backup-full.bundle` (xem §GIT cuối file).
> Bảng tra nhanh: `182c698` (đỉnh cũ) → `acb5624` (đỉnh mới, cùng nội dung).

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

## PHA 2.3 · TẦNG KÝ FE + BE SEP-45 — 2026-07-24 ✅

> Từ pha này MỌI COMMIT VIẾT TIẾNG ANH (yêu cầu user 2026-07-23 — ban giám khảo đọc;
> đã ghi CLAUDE.md root luật 5). Docs nội bộ vẫn tiếng Việt.

### Việc đã làm (4 commit)
1. `feat(contracts)`: contract `web-auth` SEP-45 (`web_auth_verify` — require_auth
   account + server + optional client_domain; SDK 26.1.1 cùng cụm OZ). Cargo test
   workspace **20/20** (15 cũ + 5 mới), 4 wasm build (web_auth.wasm 1229B).
   **Deploy testnet thật**: `CAKV3MKK…2SST`, tx `ee36e934…` (docs/evidence/TESTNET.md).
2. `feat(fe)` dep: smart-account-kit 0.4.2 vào apps/web — API đối chiếu `.d.ts` bản cài
   (RESEARCH-LOG): challenge WebAuthn = P27 auth digest → K2 thoả từ kiến trúc.
3. `feat(be)`: module `sep45` (layered, 2 endpoint public + rate-limit failOpen=false):
   GET /challenge (entries XDR — server ký sẵn entry mình, nonce Redis SET NX EX 300s)
   + POST /token (validate đủ checks spec → GETDEL nonce → **simulate qua RPC thật**
   → JWT HS256 bind **địa chỉ ví + device**, không phải user id). P1-9: bật `bearer()`
   Better Auth (WebView/extension gửi Authorization thay cookie; auth:generate no-op).
   BE test **107 pass/3 skip** (88+19). Env +8 key (parity 35). **Smoke sống**: challenge
   thật; token với entry chưa ký chết đúng `SIMULATION_FAILED Error(Auth, InvalidAction)`
   từ contract testnet; replay → `NONCE_UNKNOWN_OR_USED`.
4. `feat(fe)`: features/wallet — kit singleton (env, IndexedDB, rpId localhost dev) ·
   sep45-entries helpers (browser-safe, không Buffer) · wallet-token Bearer localStorage
   + restore lúc boot · device-id per-install · sep45-login (ký entry ví, expiration
   giữ nguyên của BE) · PasskeyPanel nối màn /passkey (i18n en+vi 91 key). FE test
   **35 pass** (25+10), validate + honest build xanh (precache 74/1536KiB).
   E2e passkey: virtual authenticator Playwright 1.61 + mock BE, assert entry ĐƯỢC KÝ
   thật; chỉ chromium (createWallet simulate deploy qua testnet thật bằng wasm hash
   `87194f61…` đã upload + origin-verifier DEV `CCNS6O5H…` rpId=localhost).

### Bug thư viện tự tìm ra (ghi cả RESEARCH-LOG)
- js-xdr 4.0.0 (bản cài): `SorobanAuthorizationEntries.toXDR(value)` hỏng ("value is
  not array") — instance toXDR không nhận value; `fromXDR` tốt. Encode tự đóng khung
  uint32+concat ở CẢ be lẫn fe (2 file đối xứng, cùng ghi chú).

### CHƯA verify — không được gọi là xanh (BLOCKERS B-23-1/B-23-2)
- E2e passkey trên CI (local fail-env chromium libs; spec chạm testnet thật — flake mạng
  là khả năng thật). Kết quả 4 workflow sau push cũng chưa đọc được từ máy này (B-CI-1).
- Tương thích kit bindings 0.3.0 ↔ contract OZ 0.7.2 của ta khi KÝ THẬT vào smart
  account — lộ ở e2e CI hoặc PHA 5.
- GATE PHA 2 (checklist): "đăng nhập passkey chạy e2e trong CI" — chờ CI; mọi phần
  còn lại của 2.3 đã có bằng chứng thật ở trên.

## PHA 3 · SCHEMA + PIPELINE INTENT — 2026-07-24 ✅ (4 commit, thuần BE)

- **3.1** (`b2639bc`): +5 bảng (families, transaction_intents idempotency unique
  (wallet,client_intent_id) + CHECK 13 state, approval_requests bind challenge_hash K5,
  care_grants, inheritance_plans) + mở rộng recovery/audit_log/wallets (additive-first).
  Migration 0001 (24 câu, 0 DROP) — **DB MỚI chạy sạch → 19 bảng**.
- **3.2** (`fcaab51`): bảng transition (state,actor,action)→state' 27 dòng — AI nhốt ở
  draft, guardian không ký/cancel, approved bắt buộc re-eval (P3), system không bao giờ
  cancel, terminal khoá. Test quét **TOÀN BỘ 13×4×19 tổ hợp** — ngoài bảng = null;
  INVALID_TRANSITION → 409 (error map).
- **3.3** (`0c3c69d`): POST /api/intents idempotent (unique DB là chốt; **50 request
  song song thật trên Postgres → đúng 1 bản ghi**) · challenge_hash K5/P4 (sửa
  amount/version/policy_version/expires → approval chết, có test) · re-eval sau approve
  qua PolicyPort (delay khi re-eval = đòi người thật, không mở ký) · sweeper BullMQ 5'
  ({hashtag} + redlock + attempts 1) quét intent+approval quá hạn → expired + audit
  từng dòng trong MỘT transaction. Bẫy postgres-js: raw sql + Date chết ở
  ParameterDescription → dùng query builder.
- **3.4** (`4a26a75`): policy engine THUẦN + version hoá (registry, version lạ = throw,
  intent cũ đánh giá bằng đúng version đã ghi — test khoá) + reason codes shared
  (+`non_payment_review`, sync:contract + check xanh, @repo/core tsc OK) · audit_log
  append-only bằng TRIGGER Postgres (migration 0002 custom) — **UPDATE/DELETE chết
  thật trên DB, test integration xác nhận dòng còn nguyên**.
- **GATE PHA 3 ✅**: bun test **138 pass / 3 skip / 0 fail** (baseline 88 → +50, không
  test nào giảm); validate xanh. Chưa verify: CI GitHub sau push (B-CI-1 còn nguyên).

## PHA 4 · PRESENCE + INDEXER + NOTIFY — 2026-07-24 ✅ (3 commit, thuần BE)

- **4.1** presence ladder: thang 24/72h thuần + biên chính xác · xác nhận tay 90 ngày
  ("máy sống ≠ người còn ký") · reserve stance + CHẶN gỡ guardian khi hết dự phòng ·
  cron mỗi giờ → ví có GIỜ ĐỊA PHƯƠNG 12:00 (wallets.timezone, migration 0003) nhận
  silent ping · sweep đổi bậc → notify CHỦ VÍ (debounce = chỉ khi đổi giá trị) + audit.
  POST /presence/ack + /confirm. **Audit checklist đạt: offline 4 ngày → đúng bậc.**
- **4.2** indexer: batch = MỘT transaction (dedupe PK event id → áp → checkpoint) —
  **kill giữa batch bằng lỗi DB THẬT → checkpoint đứng yên, chạy lại đủ, không trùng**
  (cổng nghiệm thu). Nguồn RPC = port (getEvents SDK 16: cursor XOR startLedger,
  RESEARCH-LOG); gap quá cửa sổ ~7 ngày → audit `indexer.gap`, cấm đoán lấp.
  `recovery.vetoed` priority 0 — mirror vetoed + notify NGAY. Poll 30s, INDEXER_CONTRACT_IDS
  (env 36 key) trống = no-op tới PHA 5.
- **4.3** notify ICU theo locale NGƯỜI NHẬN (intl-messageformat — CÀI TRONG be/, một
  lần lỡ tay cài root đã revert sạch): catalog en+vi, plural/select, fallback en,
  template lạ → generic an toàn; test grep chuỗi render CHẶN jargon. Recovery notify
  thêm kênh EMAIL (ngoài app). Heartbeat thừa kế: thang 1/2/3 kỳ im lặng → nhắc owner /
  hỏi người thân / **GỢI Ý** guardian mở claim (server không bao giờ tự làm — bất biến 2);
  escalation_tier debounce (migration 0005); POST /inheritance/heartbeat reset.
- **GATE PHA 4 ✅**: bun test **169 pass / 3 skip / 0 fail** (+31 so cuối PHA 3); validate
  + audit xanh. Treo có chủ đích: giao push thật (PHA 8), veto-từ-email route (PHA 5),
  locale người dùng lưu ở đâu (PHA 7 FE settings).

## PHA 5 · TẦNG STELLAR + ROUTE GHI RECOVERY — 2026-07-24 ✅ (5.1 + 5.2)

- **5.1** (`b29913b`, phiên trước): services/stellar — buildInvokeTx (simulate, trả auth
  entries) · fee-bump thuần · submit+poll · RPC fallback · ví phí tách custody.
- **5.2 route ghi recovery nối contract** (phiên này, interface đọc TỪ CHAIN — RESEARCH-LOG):
  - services/stellar +2: `simulateRead` (view fn qua simulation) + `invokeWithSignedEntries`
    (re-simulate với entry ĐÃ KÝ — chữ ký thật to hơn placeholder — ví phí ký ENVELOPE).
  - `modules/recovery` feature `onchain-actions`: POST `/api/recovery/register|initiate|approve|veto`
    (build+simulate → FE ký) · `/submit` (validate whitelist entry đã ký → submit) · `/finalize`
    (one-shot — contract không đòi auth actor, timelock on-chain gác). Gate vai trò BE:
    initiate/approve = guardian (initiator = onchainKey từ DB, không tin client) · veto/register =
    chủ ví (owner arg đọc `get_wallet_config` từ chain — đúng cả sau khi finalize đổi chủ) ·
    submit/finalize = thành viên ví. Whitelist /submit (domain thuần, test 9 ca chặn): đúng
    registry + method + ví, cấm sub-invocation, cấm source-credentials (ví phí tự authorize).
    Lỗi contract dịch mã: `Error(Contract, #9)` → `CONTRACT_ERROR:ThresholdNotMet` (bảng 16 mã
    từ chain). Rate-limit failOpen=false. Registry/ví phí chưa cấu hình → 503, app sống.
  - Indexer nối topic THẬT của registry (`register/g_add/g_remove/initiate/approve/cancel/finalize`
    — ONCHAIN-EVENTS.md): match ví theo `topics[1]`=stellarAddress (mọi event chung contractId
    registry), `cancel` priority 0 như veto. Mirror recovery_requests: indexer là NGƯỜI GHI DUY NHẤT
    (route chỉ audit actor người thật) — initiate→insert pending, approve→đếm phiếu từ event,
    cancel→vetoed, finalize→executed. +3 template notify (recovery.initiated/approved/finalized,
    en+vi, qua gate jargon).
- **GATE PHA 5 ✅ — 3 luồng e2e THẬT trên testnet** (`RUN_TESTNET_E2E=1`, 4 pass/90s, 8 tx
  trong docs/evidence/TESTNET.md §PHA 5.2): thiết lập (register, owner ký ed25519 entry) ·
  khôi phục TIMELOCK THẬT (initiate g1 → approve tới đủ ngưỡng 2 — test đọc số phiếu thật,
  không đoán initiator có được đếm — chờ `timelock_remaining=0` → finalize → `get_wallet_config.owner`
  = chủ mới trên chain) · veto khẩn (cancel bởi owner; approve sau veto chết đúng mã contract).
  Audit custody: grep `Keypair.fromSecret|.sign(` ngoài test = chỉ ví phí + SEP-45 server key — 0 ký hộ user.
- **Test:** bun test **199 pass / 7 skip / 0 fail** (172→+27; 4 skip mới = e2e testnet opt-in
  `RUN_TESTNET_E2E=1`). validate xanh.
- **Treo có chủ đích:** route intent validate/submit + care grant/revoke (phần còn lại 5.2
  checklist — cần đường ký smart-account, đụng rủi ro kit↔OZ B-23-2, làm cùng PHA 6 send-flow) ·
  veto-từ-email link ký sẵn (PHA 4 treo, cần khi FE có màn) · invalidate session/device-proof
  khi veto (TODO trong indexer, PHA 6).

## PHA 7.1 · HẠ TẦNG i18n + MODULE TIỀN — 2026-07-24 ✅ (đảo lên TRƯỚC PHA 6 có chủ đích)

> Lý do đảo (prompt phiên §1): guard check-user-copy cưỡng chế key i18n từ đầu; 40 màn PHA 6
> gần như màn nào cũng hiện tiền — dựng format tự chế rồi quay lại sửa là sờ lại đúng 40 màn.

- **ICU** (`d37ce7c`): i18next-icu vào `@repo/i18n.initI18n` + `parseMissingKeyHandler` trả
  RỖNG + `saveMissing:false` (key thiếu mọi fallback → không lộ key thô — luật N5).
  Migrate 10 catalog `{{var}}`→`{var}` (38 chỗ); `users.total` thành ICU plural thật.
  Test dây: interpolation + plural + fallback vi→en + missing-key-rỗng qua initI18n THẬT.
- **Tiền** (`f27e6d9`): `@repo/core` `money/amount` — số on-chain đi suốt pipeline dạng
  BigInt string 7 số lẻ; format CHỈ ở lá với locale TƯỜNG MINH; parser duy nhất nhận INPUT
  NGƯỜI GÕ + locale ô nhập (dấu hỏi Intl, không đoán) — **DONE-gate: "1.000" gõ ở vi = một
  nghìn, cùng phím ở en-US = 1,0 — có test**. Không hàm nào nhận lại output đã format; đường
  số thuần BigInt (test số vượt 2^53 stroop đúng từng chữ số; chuỗi rác → throw).
  `money/datetime` — Intl.DateTimeFormat locale+tz người xem; `timelockView` trả CẢ đếm
  ngược localize LẪN mốc tuyệt đối. `AmountInput` (apps/web): RAW ở state, preview format
  CẠNH BÊN — hai chuỗi tách tuyệt đối.
- **Gate:** FE validate 11/11 · test **56 pass** (35→+21: core 14→31, web 18→22) ·
  honest build xanh (4m10). Bẫy lặp lại: `pnpm add` xoá vá vitest START_TIMEOUT (vá lại cả
  2 instance .pnpm) + sinh lefthook.yml stub ở root (xoá).
- **Treo có chủ đích cho 7.2:** zh-Hans + font CJK + `_locales`/strings.xml/hreflang (nội
  dung, làm SAU PHA 6); locale số tách khỏi ngôn ngữ UI (hiện dùng i18n.language — đủ cho
  v1, tách khi có settings).

## AUDIT P0 · LỖ HỔNG KHÔI PHỤC — TÌM RA THẬT, ĐÃ VÁ + CHỨNG MINH ON-CHAIN (2026-07-24)

> Prompt audit hỏi: `finalize_recovery` của registry có xoay passkey BÊN TRONG smart
> account không? **Trả lời bằng code: KHÔNG.** Registry v1 (spike classic, ngoài repo)
> chỉ đổi `owner` trong storage của nó; e2e 5.2 verify bằng chính registry và wallet
> là account G… — chưa từng có smart account tham gia. Nặng hơn: v1 không CHỞ nổi
> vật liệu passkey (`new_owner: Address` ≠ `External(verifier, key)`). 3 bằng chứng
> grep + interface: RESEARCH-LOG mục "AUDIT P0".

### Vá (phương án B — registry làm ĐÚNG MỘT việc trên ví: xoay khoá)
- **contracts/smart-account**: `set_recovery_registry` (tự-ký) + `recovery_rotate`
  (registry là DIRECT INVOKER → invoker auth chuẩn Soroban, né hẳn bẫy
  delegated-entry-phải-tự-craft của skill §0) — thay TOÀN BỘ signer owner-rule,
  đóng dấu `last_rotation`; `__check_auth` chối MỌI chữ ký trong cửa sổ **cooldown**
  sau xoay (chống xoay-rồi-rút-ngay). Mã lỗi riêng 100/101.
- **contracts/recovery-registry v2**: giữ nguyên tên hàm + error codes 1..16 + event
  topics v1 (indexer đổi tối thiểu); `initiate_recovery` nhận `Signer` OZ — guardian
  bỏ phiếu cho ĐÚNG khoá mới; `finalize_recovery` gọi `recovery_rotate` rồi mới
  Finalized; đóng băng đổi guardian khi recovery đang mở; **chống lockout on-chain**
  (gỡ guardian dưới threshold bị chặn). `cancel_recovery(wallet)` = VÍ tự ký veto.
- **contracts/verifier-ed25519**: External signer thuần ed25519 (e2e CI không cần
  authenticator; sau này = khoá lạnh NGƯỜI DÙNG giữ — không phải backend).
- **BE v2**: initiateArgs chở (verifier, key b64) + validate; vetoArgs bỏ owner; DTO
  `new_signer_verifier`/`new_signer_key`; indexer initiate value = (initiator,
  fingerprint) → newOwner cột 56 = hex cắt 56; bảng lỗi +100/101; env trỏ registry v2.
- **Cargo test workspace 33/33** (10 test registry mới, có ký thật ed25519 qua
  `__check_auth` + finalize `set_auths(&[])` chứng minh invoker auth). BE **201 pass /
  7 skip / 0 fail** + validate xanh.

### DONE-gate audit — chứng minh TRÊN TESTNET THẬT (4 pass/0 fail, 238s, 12 tx)
- [x] Khôi phục xong → **khoá MỚI ký được tx thật** (`b675f53b…`), **khoá CŨ bị chối**
- [x] Verify signer list đọc **TỪ SMART ACCOUNT** (`get_context_rule(0)`), không phải registry
- [x] **Cooldown sau xoay tồn tại**: ngay sau finalize cả khoá mới cũng bị chối #101
- [x] Địa chỉ ví KHÔNG đổi, tiền không di chuyển — chỉ khoá bên trong đổi
- Bảng tx đầy đủ: docs/evidence/TESTNET.md §AUDIT P0. Deploy mới: registry v2
  `CAN4LHSY…27SY` · verifier-ed25519 `CAIPS7XW…LLBT` · smart-account wasm `a67ea40e…2d25`
  (FE .env + .env.example đã trỏ hash mới — CI e2e passkey dùng bản mới).

### Ghi chú cho PHA 6 (màn khôi phục)
- Màn guardian initiate/approve PHẢI decode entry + hiện **fingerprint khoá mới** trước
  khi ký (chống BE bị chiếm tráo khoá trong entry — cùng lớp chống-ký-mù K2).
- Màn "khôi phục xong" hiện trạng thái cooldown (last_rotation + cooldown_secs từ
  account) — trong cửa sổ đó ví từ chối mọi chữ ký là HÀNH VI ĐÚNG, không phải lỗi.

## PHA 6 · CHỐT ROUTE + THAY STUB — ĐANG LÀM (2026-07-24)

- **6.1 ✅** ROUTES.md xác nhận là danh sách DUY NHẤT + ghi thứ tự dựng (commit `3d40f5d`).
- **6.2 cụm ĐỌC — 5/… màn đã thay stub bằng dữ liệu thật:**
  - Feature `family` (apps/web): api typed 4 module (wallets/guardians/recovery/audit,
    envelope `{data}` khớp BE) · `useActiveWallet` (v1 ví đầu) · screen-state chung ·
    GuardianStatusBadge (chữ người thường).
  - `/guardians` + `/guardians/$guardianId` (`3d40f5d`): list + detail từ cache chung
    (BE chỉ có endpoint list — detail tra id từ list, không gọi lại); removed ẩn;
    ngày giờ qua formatDateTime PHA 7.1.
  - `/wallet/history` (`3d40f5d`): audit feed, map kind→key i18n, kind lạ→nhãn chung.
  - `/night-watch` + `/night-watch/log` (`07e98ca`): recovery mở → thẻ cảnh báo + cửa sổ
    CHẶN hiện CẢ đếm ngược lẫn mốc tuyệt đối (timelockView) + MỘT nút chặn sang /block;
    log = audit lọc sự kiện an toàn, chung cache với history. Không nút tự huỷ (luật 6).
  - i18n +37 key fw.json en+vi (ICU plural phía en), giọng ux-writer.
- **Gate mỗi batch:** validate 11/11 + honest build xanh (2 lần) + test 56 pass.
- `/inheritance` + `/inheritance/heartbeat` (commit thứ 3 của pha): heirs % qua Intl
  percent locale tường minh; nút "Tôi vẫn ổn" POST heartbeat reset thang nhắc 4.3
  (server không bao giờ tự mở thừa kế — bất biến 2). **Tổng 7 màn stub đã thay.**
- **Điểm resume cụm ĐỌC còn lại:** `/wallet` hub (chưa có endpoint balance — hiện address
  + tiles) · `/recovery/progress` (PUBLIC — cần endpoint public BE, làm cùng cụm GHI
  recovery) · `/guardian` inbox (cần endpoint approvals theo guardian — cụm GHI).
- **Điểm vào cụm GHI (phiên sau):** FE recovery actions — gọi 4 route build PHA 5.2,
  ký auth entry bằng kit (`kit.signAuthEntry`) rồi POST /submit. ⚠️ ĐÂY là chỗ rủi ro
  B-23-2 lộ ra (kit ↔ OZ 0.7.2 đường KÝ GIAO DỊCH — prompt phiên §2 có sẵn thang xử lý
  3 bước: bindings từ contract deployed → craft entry tay bằng stellar-sdk → BLOCKERS
  + đổi tuyến). Luồng /block (veto) nên đi ĐẦU: có màn night-watch trỏ sang rồi.

### 6.4 cụm GHI — guardian flow + luồng máy-mới public (2026-07-24)

- **BE guardian inbox** (`/api/recovery/guardian`): yêu cầu MỞ trên ví mình bảo hộ
  (mirror chỉ-đọc; phiếu thật đi build/approve+submit). Integration test scoping:
  chuyện đã đóng / guardian removed / người lạ = 0 dòng.
- **BE luồng public** (người mất máy chưa có session): `POST /public/device-request`
  (thiết bị mới nộp vật liệu khoá → server CHỈ chuyển lời + notify guardian, ví lạ vẫn
  200 anti-enumeration), `GET /public/progress` (trường vô hại, vốn public on-chain),
  `GET /guardian/device-requests`. Bảng `recovery_device_requests` (migration 0006,
  additive) + template `recovery.device_requested`. **Fingerprint = sha256(Signer ScVal)
  pin vector CHÉO Rust↔TS** (đổi công thức một bên → hai test cùng đỏ).
- **FE guardian** (`/guardian` inbox + `/approve` + `/initiate` + `/approved`): inbox gộp
  cả yêu cầu bỏ-phiếu lẫn "tiếng gõ cửa" máy mới. `initiate` có 3 hàng rào: xác minh
  ngoài băng (đọc fingerprint qua điện thoại) + **chống-ký-mù TỰ ĐỘNG** (`entry-fingerprint`
  so khoá TRONG entry vs mirror trước khi ký — BE tráo khoá là dừng) + prompt passkey.
- **FE luồng máy mới** (`/recovery` public 6 màn): start → find-wallet (tạo passkey mới
  tại chỗ qua `kit.credentials.create` → gửi vật liệu public) → sent (hiện fingerprint để
  đọc cho người thân) → progress (poll 30s) → countdown (timelock nhìn từ người khôi phục)
  → done (`connectRecoveredWallet` bind credential vào ví cũ — địa chỉ không đổi + lưu ý
  cooldown). `device-recovery.ts` khép kín; draft ở localStorage.
- **FE wallet hub + receive**: địa chỉ ví thật + copy (số dư chờ SAC balance endpoint —
  ghi treo). i18n +~70 key en+vi qua giọng ux-writer.

### 6.3 cụm GHI — luồng VETO (/block) THẬT (2026-07-24, sau audit P0)

- `features/family/api/recovery-actions.ts` — build/submit/finalize thuần HTTP (khớp
  route v2: initiate chở `new_signer_verifier` + `new_signer_key`).
- `features/wallet/lib/sign-recovery-entries.ts` — ký entry CỦA VÍ bằng passkey qua
  `kit.signAuthEntry` (K2 từ kiến trúc: digest dẫn xuất từ entry — công thức đã chứng
  minh on-chain ở audit P0); entry người khác giữ nguyên; chối sớm khi ví chưa connect
  hoặc build không có entry của ví. Unit test 3 ca (kit mock — đường crypto thật đã
  phủ ở e2e BE + chờ e2e CI).
- 3 màn `/block` hết stub: alert (hiện fingerprint KHOÁ MỚI + cửa sổ chặn timelockView,
  MỘT nút — luật veto) → confirm (cổng sinh trắc học = chính prompt passkey; taxonomy
  lỗi "lệnh chặn ĐÃ đến mạng chưa": walletLocked / alreadyStopped / tooLate / notSent)
  → done (tx hash thật qua search param + link explorer theo MẠNG env —
  `lib/stellar-explorer.ts`). i18n en+vi +18 key giọng người thường.
- Mirror sau veto do INDEXER ghi từ event `cancel` (route chỉ audit) — confirm chỉ
  invalidateQueries chờ indexer bắt kịp, không tự ghi trạng thái.

## CI · SCAN + FIX CI ĐỎ (2026-07-23)

SHA sau fix: `e2682fd` (3 commit, đẩy lên `main`: `9ccc08b..e2682fd`).
Máy này KHÔNG có `gh` và KHÔNG có `GITHUB_TOKEN` → không đọc được log Actions.
Cách làm: đọc `.github/workflows/*.yml` rồi TÁI HIỆN LOCAL đúng lệnh + đúng version CI pin.

### 3 nguyên nhân đỏ đã sửa (mỗi nguyên nhân 1 commit)

1. `91eeb57` — **secret-scan chết ở bước load config** (job này chạy MỌI push, không lọc path
   → repo đang đỏ liên tục). `.gitleaks.toml` giữ cả `[allowlist]` (số ít, deprecated) lẫn
   `[[allowlists]]`; từ 8.25 gitleaks coi việc có cả hai là LỖI CHẾT, mà CI pin đúng 8.30.1:
   `FTL Failed to load config error="[allowlist] is deprecated…"` — exit 1 trước khi quét
   commit nào. Gỡ bảng số ít. Không đụng rule, không nới phạm vi quét.
2. `ecb2c22` — **ci-be `bun audit --audit-level=high` exit 1**: axios 1.16.1
   (GHSA-gcfj-64vw-6mp9, qua @stellar/stellar-sdk) + brace-expansion 5.0.6
   (GHSA-3jxr-9vmj-r5cp, qua @sentry/bun và firebase-admin). Ghim bản vá bằng `overrides`
   trong be/package.json — đúng cơ chế repo đã dùng cho lodash/grpc-js/protobufjs/tmp/undici.
3. `e2682fd` — **ci-fe job supply-chain `pnpm audit --audit-level=high` exit 1**: axios 1.16.1
   (cùng nguồn stellar-sdk) + fast-uri 3.1.3 (GHSA-v2hh-gcrm-f6hx, qua vite-plugin-pwa →
   workbox-build → ajv). Thêm `pnpm.overrides` vào fe/package.json.

Cả 3 đều là gate THẬT — không hạ `--audit-level`, không ignore CVE, không `continue-on-error`,
không sửa/xoá test, không nới `paths`. Hai CVE audit là loại "CI đỏ mà không ai commit gì":
`bun/pnpm audit` hỏi advisory DB sống, advisory mới công bố là gate đỏ ngay.

### Bằng chứng tái hiện local (chạy đúng lệnh + version CI pin)

| Gate | Lệnh | Trước | Sau |
|---|---|---|---|
| secret-scan | `gitleaks git --redact --no-banner` (8.30.1) | FTL, exit 1 | 127 commit, **no leaks**, exit 0 |
| ci-be audit | `bun audit --audit-level=high` | 2 high, exit 1 | **sạch**, exit 0 |
| ci-be validate | `bun run validate` | xanh | xanh (tsc+biome 167+boundaries+env-parity 27+contract) |
| ci-be test | `bun test` | 88 pass | **88 pass, 3 skip, 0 fail** (đúng baseline) |
| ci-fe audit | `pnpm audit --audit-level=high` | 12 mod + **2 high**, exit 1 | 3 mod, **0 high**, exit 0 |
| ci-fe validate | `turbo run validate` | xanh | **11/11 task** |
| ci-fe test | `turbo run test` | 25 | **25 pass 0 fail** (core 14 + ui 3 + web 8) |
| ci-fe build | `turbo run build --force` | xanh | **1/1**, PWA precache **73 entries** (1087.60 KiB) |
| ci-contracts | `cargo fmt --check` + `cargo test --workspace` | xanh | fmt OK, **15/15 pass** |
| ci-contracts | `stellar contract build` (stellar 27.0.0) | xanh | **3 wasm**, exit 0 |

Lockfile `be/bun.lock` + `fe/pnpm-lock.yaml` đổi CÓ CHỦ ĐÍCH (lô nâng dependency, CLAUDE.md
luật 3) — đã `--frozen-lockfile` + validate + test + build lại cả hai bên, đều exit 0.
`be/bun.lock` giữ nguyên `lockfileVersion: 1` (bun local 1.3.14 không ghi đè format của
bun 1.3.11 mà CI pin) — diff chỉ là mấy dòng override.

### CHƯA verify được — KHÔNG coi là xanh (xem BLOCKERS.md §CI)

- **Kết quả CI thật**: máy không có `gh`/token → phải người mở tab Actions xem.
- **Job e2e (ci-fe.yml)**: fail-env trên máy này (thiếu libnspr4/libnss3/libasound2, không sudo).
  Không có DẤU HIỆU hỏng: workflow đã dùng `playwright install --with-deps` và Playwright
  1.61 biết Ubuntu 24.04 (`libasound2t64`) — nhưng chưa chạy được thì chưa được nói là xanh.
- **Nhánh matrix Node 24** của ci-fe: máy chỉ có Node 20.20.2 + 22.23.1, chạy gate bằng 22.

### Bẫy môi trường gặp lại trong phiên này
- `prepare: lefthook install` sinh `lefthook.yml` stub ở root sau MỖI install (be lẫn fe) — xoá.
- Vá vitest `START_TIMEOUT` trong node_modules mất sau mỗi `pnpm i` — phải vá lại mới chạy test.
- `lệnh | tail -N` → `$?` là của `tail`, luôn 0. Dùng `${PIPESTATUS[0]}` và đọc NỘI DUNG output.

## GIT · GỘP LỊCH SỬ TEMPLATE (2026-07-23)

Mục tiêu: mở repo ra thấy lịch sử bắt đầu từ nền dự án, mọi commit sau đó là việc thật —
không phải 3 tháng commit template của dự án khác (commit cũ đứng tên "CDHC Dev").
Đây là DỌN DẸP, không phải giấu nguồn gốc: commit gốc GHI RÕ có dùng template nội bộ MSCI.

- Mốc cắt `eb22518` (`Add 'fe/' …`) — commit subtree CUỐI. Kiểm bắt buộc trước khi chạy:
  `git log --merges eb22518..main | wc -l` = **0** (không còn merge nào sau mốc → rebase an toàn).
- Gốc mới `d36c5d3` `chore: nền dự án family-wallet — BE + FE` (orphan, 1 commit, 0 parent).
- `git rebase --onto tmp-root eb22518 main` → **15/15 commit phát lại, KHÔNG xung đột**.
- **136 commit → 16** (1 gốc + 15 việc thật). Đỉnh mới `acb5624`.

### Bằng chứng an toàn (4 gate của runbook §4)

| Gate | Kết quả |
|---|---|
| 4.1 cây làm việc y hệt | `git diff backup-full main` **rỗng**; tree SHA **`9585b42` giống hệt** hai bên — không lệch 1 byte |
| 4.2 hình dạng lịch sử | gốc = commit nền · **16 commit** · **0 merge** · tất cả `2026-07-23` (sạch tháng 5/6 + 9-10/7) · tác giả duy nhất `lipxjh1`, hết "CDHC Dev" |
| 4.3 build còn xanh | BE `validate` xanh + `bun test` **88 pass, 3 skip, 0 fail** · FE `validate` **11/11** + test **25 pass** |
| 4.4 secret trên lịch sử mới | gitleaks 8.30.1 quét đúng **16 commit** của `main` → **no leaks**, exit 0 |

### Lưới an toàn — ĐÃ CHUYỂN RA NGOÀI REPO (2026-07-23, sau khi dọn nhánh)

Nhánh `backup-full` (`182c698`, đủ 136 commit) từng là lưới an toàn, nay **đã xoá cả local lẫn
remote** để repo chỉ còn đúng `main` (nhánh nào cũng lộ với người xem được repo — để lại
`backup-full` là phơi nguyên lịch sử template, đúng thứ việc rewrite này muốn dọn).

Trước khi xoá đã bundle ra NGOÀI repo — file này KHÔNG nằm trong git, không ai thấy trên GitHub:

```
../family-wallet-backup-full.bundle          # 1.4 MB, cạnh thư mục family-wallet/
git bundle verify ../family-wallet-backup-full.bundle    # "records a complete history"
```

Khôi phục khi cần:

```bash
git clone --branch backup-full ../family-wallet-backup-full.bundle /tmp/khoi-phuc
# hoặc kéo thẳng vào repo hiện tại:
git fetch ../family-wallet-backup-full.bundle backup-full:backup-full
```

**Đã CHỨNG MINH bundle phục hồi được TRƯỚC khi xoá nhánh** (không tin suông): clone thử từ
bundle ra thư mục tạm → **136 commit**, đỉnh `182c698`, tree SHA `9585b42` **giống hệt** bản gốc.

⚠️ Bundle giờ là bản sao DUY NHẤT của lịch sử cũ. Mất file đó = mất luôn đường lùi.
**Giữ tới khi thi xong**, nên copy thêm một bản ra ổ khác/cloud.
- Máy nào đã clone repo này phải chạy `git fetch && git reset --hard origin/main` —
  pull thường sẽ tạo merge bậy giữa hai lịch sử không cùng gốc.
- Mọi SHA ghi trong tài liệu trước 2026-07-24 tra không ra (ghi chú ở đầu BUILD-LOG + BLOCKERS).

## PHA 7.2 · zh-Hans + font CJK (2026-07-24)

- Locale **zh** (Giản thể) đủ 5 namespace (common/auth/errors/admin/fw — **parity 100%
  với en**, kiểm bằng script so key). `load:"languageOnly"` gộp zh-CN/zh-Hans/zh-TW → "zh"
  nên MỘT catalog phục vụ mọi biến thể. Đăng ký `supportedLngs:["en","vi","zh"]` + eager
  common_zh.
- ICU giữ nguyên: plural tiếng Trung chỉ có `other` (đã dùng đúng ở mọi chuỗi đếm).
- **Font CJK system stack** nối cuối `--font-sans` (PingFang/YaHei/Noto Sans CJK) — không
  tải webfont (0 request/nhị phân thêm); đứng cuối nên không đụng en/vi.
- Language switcher vòng en→vi→中; `<html lang>` đồng bộ theo ngôn ngữ (a11y + trình duyệt
  chọn đúng font CJK).
- Treo có chủ đích: `_locales`/strings.xml (APK) + hreflang tag tĩnh SSR — làm khi có domain.

## PHA 8 · APK Capacitor (2026-07-24 — config sẵn, build gate máy thật)

- `capacitor.config.json` (appId `app.familywallet`, webDir `dist`, androidScheme `https`).
  Dùng JSON (không .ts) để KHÔNG đụng tsc/lockfile — bản web vẫn xanh.
- Well-known template: `public/.well-known/assetlinks.json` (placeholder SHA-256 cert PHÁT
  HÀNH) + `apple-app-site-association` (Team ID + webcredentials + applinks recovery/guardian/block).
- `fe/mobile/README.md`: gate P0-M1 (passkey/push/secure-storage trên máy thật), lệnh setup
  (cài `@capacitor/*` + `@capgo/capacitor-passkey`…), push 2 loại, secure storage, store checklist.
- **KHÔNG cài dep Capacitor vào package.json** (máy build thiếu JDK/SDK/Xcode → cài mà không
  install được sẽ phá `--frozen-lockfile` CI). Lệnh cài nằm ở README, chạy trên máy có toolchain.

## PHA 9.1 · Extension MV3 (2026-07-24 — load-unpacked chạy được)

- `extension/`: manifest MV3 (host_permissions chỉ domain mình — M2; `_locales` en/vi/zh_CN
  — M5; permissions tối thiểu alarms/storage/notifications) + service worker (poll
  `/api/recovery/guardian` + `/device-requests` mang cookie → **badge đỏ** đếm yêu cầu;
  `chrome.alarms` 1' không setInterval; state ở `chrome.storage.session` không biến toàn cục)
  + popup (đọc storage + nhờ SW poll-now; mở web `/guardian`).
- Giá trị vỏ app (đường A): guardian ngồi máy tính thấy số đỏ → xử lý 30 giây.
- Provider dApp (đường B, `KitActions`) + ký thật trong extension = việc SAU (README ghi).
- `key` cố định (M1): bản unpacked ID ổn định theo path (đủ demo); lên store thêm `key` +
  origin-verifier allow-list `chrome-extension://<id>` — README có lệnh sinh key.
- KHÔNG wire vào pnpm/turbo (static unpacked) → web gate không đụng.

## PHA 10 · Threat model + rà tổng (2026-07-24)

- `docs/THREAT-MODEL.md` 1 trang, KHỚP CODE: 4 bất biến ánh xạ file thật · 5 kẻ địch mỗi
  dòng một đòn đỡ có nơi cưỡng chế · lỗ hổng ĐÃ vá (P0 + phiếu ma/DoS/lockout) · bất biến
  kỹ thuật đang test (K1/K2/K5/fingerprint vector/audit trigger/indexer) · phần "còn hở"
  khai thẳng (origin-verifier DEV, WebAuthn-kit nhánh passkey, AI chưa nối, mainnet chưa lên).
- Câu hỏi thử vàng "chiếm backend làm được gì" trả lời bằng thiết kế thật: registry chỉ là
  invoker cho ĐÚNG cửa recovery_rotate + cooldown; BE không ký được của user.

## PHA 6 SEND + tạo ví · HAI ĐẦU PHỄU — 2026-07-24

> Prompt "hai đầu phễu": lõi khôi phục/guardian xong, còn thiếu GỬI TIỀN + TẠO VÍ.
> Send trước (đường mòn, mở "ví hoàn chỉnh"); tạo ví mức A sau.

### SEND — đóng CHUỖI HAI-NỬA (passkey → __check_auth → verifier → transfer, 1 tx)
- Sự thật giao thức: ví C… KHÔNG dùng payment op → invoke `transfer` trên SAC
  (RESEARCH-LOG SEND). SAC native testnet `CDLZFC3S…CYSC`. amount i128 stroops.
- BE `modules/intents/features/send-flow`: lái intent qua pipeline PHA 3 (KHÔNG gọi
  thẳng SAC từ màn nhập): prepare(draft→validating→**kiểm số dư TRƯỚC biometric**→review)
  · confirm(policy: allow→build tx+awaiting_signature | người lạ/vượt 20M XLM→awaiting_guardian
  +phiếu bound K5 | delay→đứng policy_gate) · guardian-approve(off-chain, K5 binding + P3
  re-eval — guardian clear ngưỡng đã kích hoạt, không áp lại → không loop) · sign(whitelist
  entry: SAC+transfer+from=ví, không sub-invocation → submit → settled/submit_failed).
  `domain/transfer.ts` thuần (transferArgs/balanceArgs/validateSignedTransfer). Env
  `CONTRACT_ID_SAC_NATIVE` (chưa set → 503).
- FE `/wallet/send`: máy 4 bước nhập→review→ký→xong; AmountInput PHA 7.1 (RAW+parse locale,
  cấm format tự chế); cổng sinh trắc học = prompt passkey (signWalletEntries — tách chung với
  recovery); vượt ngưỡng → màn "chờ người thân"; taxonomy lỗi "tiền đã đi chưa" (insufficient
  kèm shortfall / badRecipient / delayed / walletLocked / network / notSent).
- **E2e testnet 2 pass, 3 tx** (`docs/evidence/TESTNET.md §PHA 6 SEND`): deploy ví C… → nạp
  XLM (G→SAC→C) → **gửi 1 XLM, người nhận NHẬN ĐỦ đúng số** (đọc SAC.balance). Số dư thiếu +
  guardian-gate phủ bằng integration test (5 ca DB thật). **Đóng rủi ro kỹ thuật lớn nhất còn lại.**

### TẠO VÍ mức A (ví một người ký, thêm guardian sau)
- BE `POST /api/wallets`: mirror ví C… FE deploy (không deploy/không giữ khoá); idempotent
  theo địa chỉ cho chính user, địa chỉ user khác → 409.
- FE `/setup` + `/setup/done`: kit.createWallet (passkey + deploy) → mirror BE → wallet hub;
  màn done nhắc thêm guardian là bước kế. Wizard đầy đủ (chọn guardian/threshold/timelock —
  cần trao đổi khoá đa bên) là Mức B, các màn setup/* khác giữ nhãn đúng.

### Deploy-readiness (PHA 9.2 prep, không cần key)
- `docs/DEPLOY.md` go-live checklist + bảng contract (v2 dùng, v1 bỏ) · extension `key` CỐ ĐỊNH
  → ID `chrome-extension://aakakeieeijeflbnblolnlhmooibddmc` (origin phải allow-list verifier prod)
  · `contracts/scripts/deploy-origin-verifier.sh` tham số hoá.

### Gate
- BE **225 pass / 7 skip / 0 fail** (+ e2e send opt-in) · contracts 34/34 · FE validate/test/build
  (gate cuối phủ send+setup+create-wallet).

### Còn stub (subsystem chưa dựng) / PARK
- Wizard setup mức B (trao đổi khoá guardian đa bên) · night-watch alert/resolve/waiting/
  guardian-view · guardian/approve-warning (cần AI risk) · inheritance/claim · welcome/get-started.
- PARK 9.2 mainnet: cần key + domain (DEPLOY.md sẵn).
