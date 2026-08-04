# MAINNET-CHECKLIST — testnet → mainnet (PHA 3+4, 2026-07-26)

> **Core deployment update (2026-08-04): PREPARED, NOT DEPLOYED.** Reproducible artifact locks, fail-closed scripts, and evidence templates are documented in [`docs/MAINNET-DEPLOYMENT.md`](docs/MAINNET-DEPLOYMENT.md). The public application remains on Testnet. No Mainnet transaction was sent because the operator gates were missing.

Nguồn sự thật về tiến độ migrate. Quyết định đã chốt:
(a) dùng TÊN BIẾN THẬT `VITE_STELLAR_RPC_URL` / `VITE_STELLAR_NETWORK_PASSPHRASE` / `VITE_PASSKEY_RP_ID`;
(b) `/rpc` proxy upstream = `STELLAR_RPC_URL`, key optional qua `STELLAR_RPC_API_KEY` (Bearer).
Luật: không bịa tên biến (schema + example cùng commit) · không đụng `deploy/.env.production` ·
không đổi rpId · fail-closed (không default ngầm testnet) · KHÔNG deploy/push · commit theo mục.

## A — ENV FAIL-CLOSED

- ✅ A1. FE `env.ts`: xoá default testnet 2 biến Stellar → bắt buộc, throw sớm; giữ guard PROD rpId
  - `fe/apps/web/src/lib/env.ts` (2 biến hết default, message rõ dev/prod)
  - `fe/apps/web/vite.config.ts` (test.env cấp 2 biến tường minh — fixture test, không phải default app)
- ✅ A2. BE `env.schema.ts`: 4 biến hết default → required (STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, SEP45_HOME_DOMAIN, SEP45_WEB_AUTH_DOMAIN)
  - `be/src/env.schema.ts` · `be/src/env.schema.test.ts` (completeness-lock 7→11, fixture +4) · `be/scripts/env-check.test.ts` (fixture +4)
- ✅ A3. `STELLAR_RPC_API_KEY` optional vào schema (`be/src/env.schema.ts`)
- ✅ A4. 4 file example cập nhật section mainnet + 2 cách nạp key:
  - `fe/apps/web/.env.example` (2 biến ACTIVE giá trị dev testnet — ci-fe copy file này làm .env)
  - `fe/apps/web/env.production.example` (RPC=/rpc proxy + passphrase mainnet ACTIVE)
  - `be/.env.example` (4 biến required ACTIVE giá trị dev; API key 2 cách, comment)
  - `be/deploy/env.production.example` (STELLAR_RPC_URL=`<placeholder>` → env-check GATE đỏ tới khi điền; passphrase mainnet literal; SEP45 domain prod ACTIVE; SIGNING_KEY ghi rõ key mainnet RIÊNG)
  - Bằng chứng: `bun test env.schema+env-check` 16 pass · `check:env-parity` OK 39 key

## B — BE ROUTE POST /rpc

- ✅ B1. Proxy JSON-RPC 2.0 → `env.STELLAR_RPC_URL`; POST only; allowlist đúng 12 method đề bài; ngoài allowlist → `-32601 METHOD_NOT_ALLOWED` (không forward); batch mảng → `-32600 BATCH_UNSUPPORTED`; JSON hỏng → `-32700`; cap body 512KB → 413. Chỉ forward 4 field chuẩn jsonrpc/id/method/params (field lạ của client không lên provider).
  - `be/src/modules/rpc/service.ts` (allowlist + schema + forward, timeout upstream 30s)
  - `be/src/modules/rpc/routes.ts` · `be/src/app.ts` (mount `/rpc` — ngoài `/api/*`, sau cors `*` toàn cục)
- ✅ B2. Rate-limit theo mẫu sep45: **120 điểm / 60 giây / key (user-id hoặc IP), `failOpen=false`**. Rộng hơn sep45 (10/60) vì một lượt gửi tiền = simulate + fees + send + poll getTransaction ~2s/lần; 2 req/s trung bình vẫn chặn kẻ quét.
- ✅ B3. Key không lộ: chỉ nằm trong header Authorization gửi upstream; lỗi upstream trả mã cố định (`RPC_UPSTREAM_UNREACHABLE`/`RPC_UPSTREAM_STATUS_xxx`); log CHỈ `err.name`/status — không message (message fetch có thể chứa URL chở key). Test assert response không chứa key/URL ở cả 2 đường lỗi.
- ✅ B4. CORS: `app.use("*", cors(...))` đứng TRƯỚC mount `/rpc` (app.ts) → phủ tự động; test preflight OPTIONS + POST với `Origin: https://familyhaven.mscilabs.com` nhận đúng ACAO (cùng khuôn middleware). ⚠️ VPS: `TRUSTED_ORIGINS` phải chứa `https://familyhaven.mscilabs.com` — ghi ở khối H2.
- ✅ B5. `bun test src/modules/rpc/routes.test.ts` → **11 pass, 0 fail** (pass-through + params · method lạ · batch · parse error · 413 · Bearer đúng + key không rò ×2 · không key → không header · rate-limit thật 121 req → 429 + Retry-After · CORS preflight). Cần Dragonfly local (skip-nêu-lý-do nếu thiếu).

## C — FE WIRING

- ✅ C1. deploy-fe.yml step Build: `VITE_API_URL=$API_ORIGIN` (đã có) · `VITE_STELLAR_RPC_URL=$RPC_URL` (= https://api.familyhaven.mscilabs.com/rpc, env mới thay RPC_ORIGIN testnet) · `VITE_STELLAR_NETWORK_PASSPHRASE` = mainnet (hết hardcode testnet dòng 100 cũ) · `VITE_PASSKEY_RP_ID=$PASSKEY_RP_ID` (đã có, giữ nguyên)
  - `.github/workflows/deploy-fe.yml` (env block + step Build)
- ✅ C2. 4 biến chain vào step Build từ `vars.VITE_ACCOUNT_WASM_HASH` / `vars.VITE_WEBAUTHN_VERIFIER_ADDRESS` / `vars.VITE_RECOVERY_REGISTRY_ADDRESS` / `vars.VITE_SAC_NATIVE`
- ✅ C3. `fe/apps/web/public/.well-known/stellar.toml`: `NETWORK_PASSPHRASE` mainnet; `WEB_AUTH_CONTRACT_ID = "__WEB_AUTH_CONTRACT_ID__"` template; step mới trong deploy-fe.yml sed từ `vars.WEB_AUTH_CONTRACT_ID` (cùng cơ chế `_headers`). ⚠️ `SIGNING_KEY` vẫn là G testnet dev — có comment BLOCKER tại chỗ, xem H3 (ngoài phạm vi C3, cần key mainnet mới thay được).
- ✅ C4. `fe/apps/web/public/_headers`: connect-src = `'self' __API_ORIGIN__` (gỡ `__RPC_ORIGIN__`); sed step chỉ còn thay API origin; `deploy/nginx.conf` vốn đã chỉ có `__API_ORIGIN__` → hai file tự đồng bộ.

## D — GATES TRONG deploy-fe.yml

- ✅ D1. Step "Gate mainnet vars (D1)" trước Build: fail + echo đúng TÊN biến thiếu cho 4 biến chain + `WEB_AUTH_CONTRACT_ID`. Cố ý fail-loud (khác skip-deploy của CF secrets): workflow sẽ ĐỎ tới khi điền GitHub vars — đúng thiết kế.
- ✅ D2. `grep -rqE "${Q}familyhaven\.mscilabs\.com${Q}"` (Q=`['"]`) trên dist/assets — PHẢI có (thay gate rpId cũ không-quote)
- ✅ D3. `grep -rqE "${Q}mscilabs\.com${Q}"` — PHẢI KHÔNG có (apex quoted; `"familyhaven.mscilabs.com"` không dính vì trước `mscilabs` là dấu chấm)
- ✅ D4. `soroban-testnet|Test SDF Network|friendbot` — PHẢI KHÔNG có trong dist/assets. Kéo theo: sửa message lỗi env.ts (A1) bỏ literal giá trị testnet (nó bị nướng vào bundle → tự làm D4 đỏ); message giờ trỏ `.env.example`/`env.production.example`. Đã rg toàn src (loại *.test.*): 0 tripwire còn lại.
- ✅ D5. dist stellar.toml: PHẢI có passphrase mainnet; PHẢI KHÔNG có `__WEB_AUTH_CONTRACT_ID__`/`Test SDF`. Placeholder-check toàn dist thêm `__WEB_AUTH_CONTRACT_ID__`.
- ✅ D-localhost: **BỎ gate cứng, có ghi chú trong workflow** — guard fail-closed của env.ts (`=== "localhost"` + message) tự chứa literal `"localhost"` trong bundle → false-positive chính đáng. Giữ cảnh báo mềm in context; D2/D3 vẫn là gate cứng cho rpId.
  - File: `.github/workflows/deploy-fe.yml` (step D1 + khối Verify dist) · `fe/apps/web/src/lib/env.ts` (message)
- ✅ D-tinh-chỉnh (phát hiện khi chạy gate THẬT trên dist ở mục I4, sửa lại workflow):
  1. **Backtick:** esbuild minify đổi nháy thành backtick — rpId nằm dạng `` `familyhaven.mscilabs.com` `` → char class D2/D3 thành `['"\`]`, nếu không D2 false-negative (đo thật: FAIL trước sửa, PASS sau sửa).
  2. **vendor-stellar:** `Test SDF Network` (hằng `Networks.TESTNET`) + `friendbot` (helper `requestAirdrop`) LUÔN có trong code THƯ VIỆN stellar-sdk → match duy nhất nằm ở `vendor-stellar-*.js`. D4 tách 2 tầng: `soroban-testnet` quét toàn bộ (0 hit); `Test SDF Network|friendbot` quét mọi chunk TRỪ vendor-stellar (code app import hằng đó sẽ nằm chunk khác → vẫn bị bắt).

## E — GUARD E2E

- ✅ E. Guard module-scope trong cả 2 file `onchain.e2e.test.ts` (recovery + intents/send-flow): passphrase mainnet → `throw` ngay lúc LOAD module, trước mọi knob — `RUN_TESTNET_E2E=1` không bypass được.
  - Bằng chứng chạy thật: `STELLAR_NETWORK_PASSPHRASE=<mainnet> bun test onchain.e2e` → 2 fail "onchain.e2e CHỈ chạy testnet…"; env testnet thường → 6 skip 0 fail (như trước).
  - File: `be/src/modules/recovery/features/onchain-actions/onchain.e2e.test.ts` · `be/src/modules/intents/features/send-flow/onchain.e2e.test.ts`

## F — TTL-KEEPER PHỦ NỐT

- ✅ F. Hạ tầng vào vòng gia hạn cron 03:00 UTC (chạy TRƯỚC vòng per-wallet, KHÔNG phụ thuộc `CONTRACT_ID_RECOVERY`; cần `FEE_WALLET_SECRET` để trả phí):
  - **Cách:** origin-verifier + web-auth KHÔNG có hàm `extend_ttl`, và WASM code entry thì không hàm contract nào chạm được → dùng thẳng `ExtendFootprintTTLOp` (service mới `be/src/services/stellar/ttl.service.ts`: `extendEntriesTtl` — simulate → trần phí B-SEC-3 → ví phí ký → submit+poll; `fetchWasmHashHex` — tự khám phá code hash qua `getLedgerEntries(instance)`, không cần env hash cho từng contract).
  - **Target:** instance origin-verifier + web-auth + registry (registry instance thêm vào đây để phủ ca 0 ví — `extend_ttl(wallet)` chỉ chạy khi có ví) + code entry của 3 contract đó (hash khám phá RPC) + code smart-account từ env `ACCOUNT_WASM_HASH`. Mỗi target MỘT tx — một contract chưa deploy không làm hỏng lượt của entry còn lại.
  - **Env mới (schema + 2 example cùng commit, luật 1):** `CONTRACT_ID_ORIGIN_VERIFIER` (convention CONTRACT_ID_*), `ACCOUNT_WASM_HASH` (mirror FE VITE_ACCOUNT_WASM_HASH) — cả hai optional, parity 41 key OK.
  - **Bằng chứng:** `bun test src/jobs/ttl-keeper.test.ts` 4 pass (khoá danh sách target theo env, giải mã ngược LedgerKey đúng contract/hash, cách ly lỗi từng target, RPC chết không throw ra cron) · typecheck sạch · **dry-run THẬT**: `fetchWasmHashHex` trên testnet RPC trả đúng wasm hash 3 contract dev (origin-verifier `21164f7b…`, web-auth `e44a1fcb…`, registry `bb503a91…`).
  - **⚠️ ĐÍNH CHÍNH (audit PHA 5, 2026-07-26 — commit `audit: T6`):** lần chạy THẬT đầu tiên trên testnet phơi ra job này CHƯA TỪNG gia hạn nổi entry nào, 2 lỗi:
    1. `TTL_EXTEND_TO=3_110_400` là MALFORMED — core chối `extendFootprintTtlMalformed` lúc submit (max là maxEntryTTL−1) trong khi **simulate vẫn OK** → mọi tx instance chết `SUBMIT_REJECTED:txFailed`. Sửa: `3_110_399` (tx chứng minh `a2927cff…` SUCCESS).
    2. Trần phí 5M stroop chặn sạch WASM code entry — đo thật: web-auth:code 35_498_854, registry:code **235_602_550 stroop (~23.6 XLM)**. Sửa: trần riêng `TTL_INFRA_MAX_FEE_STROOPS=400M` cho hạ tầng (id từ env, không có bề mặt B-SEC-3); per-wallet giữ 5M.
    Chạy thật sau sửa (`bun run scripts/ttl-keeper-once.ts`): **infra 4 extended / 0 failed**, TTL 4 entry → 6.92M (Δ ≈ +3.0M ledger), tx `85a46ee6…`, `3b55810a…`, `f82eb3ac…`, `6cd15cc0…` (stellar.expert/explorer/testnet/tx/<hash>). **Hệ quả mainnet:** ví phí §2.4 phải trù ~40 XLM cho lượt extend code entry ĐẦU TIÊN (các tick sau chỉ trả delta nhỏ).
  - File: `be/src/services/stellar/ttl.service.ts` (mới) · `be/src/jobs/ttl-keeper.ts` · `be/src/jobs/ttl-keeper.test.ts` (mới) · `be/src/env.schema.ts` · `be/.env.example` · `be/deploy/env.production.example`

## G — DERIVE VITE_SAC_NATIVE

- ✅ G. Chạy thật bằng stellar-cli 27.0.0 (local), đối chứng 2 cách ra CÙNG kết quả:
  - `stellar contract id asset --asset native --network mainnet`
  - `stellar contract id asset --asset native --network-passphrase "Public Global Stellar Network ; September 2015" --rpc-url https://mainnet.sorobanrpc.com`
  - **`VITE_SAC_NATIVE` = `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`** (ghi vào bảng H1)
  - Sanity: cùng lệnh với testnet ra id KHÁC (`CDLZFC3S…`) — id gắn chặt network, đúng kỳ vọng.

## H — DOCS CHỐT

- ✅ H1. Bảng "GitHub vars phải điền" — cuối file
- ✅ H2. Khối "VPS .env.production delta" — cuối file
- ✅ H3. BLOCKERS theo thứ tự làm — cuối file

## I — VERIFY TOÀN CỤC

- ✅ I1. `rm -rf fe/node_modules fe/apps/web/node_modules` → `pnpm install --frozen-lockfile` → "Done in 3m 14s using pnpm v9.15.9", exit 0. ~~(Sau install: vá lại vitest START_TIMEOUT trong node_modules — vá LOCAL không commit.)~~ **Audit PHA 5 (`audit: F3`): vá đã chuyển thành `pnpm.patchedDependencies` + `fe/patches/vitest@4.1.9.patch` COMMIT vào repo — install tự áp, KHÔNG còn vá tay.** Clean-room 2026-07-26: wipe → install 7m0.1s → patch tự áp (6e5/6e5) → `pnpm validate` 11/11 tasks exit=0 · `pnpm test -- --force` ui 3 + core 31 + web 80 = **114 pass, 0 fail** exit=0 — không đụng node_modules.
- ⚠️✅ I2. `pnpm test` → **Tasks 5 successful** (toàn workspace, sau vá vitest). `pnpm typecheck` chạy riêng → **5/5 successful** (tsr generate + tsc 2 tsconfig). `pnpm validate` → **FAIL CÓ SẴN, KHÔNG do thay đổi này** — nguyên văn:
  ```
  scripts/csp-script-hash.mjs format ━━━
    ✖ File content differs from formatting output
  Found 1 error.
   ELIFECYCLE  Command failed with exit code 1.
  ```
  Bằng chứng "có sẵn": file KHÔNG bị sửa trong nhánh này (`git status` sạch), lần chạm cuối là commit `a7b00af` (nhánh nền `feat/fe-ui-assets`, trước khi bắt đầu mainnet); 2 file tôi sửa (`env.ts`, `vite.config.ts`) qua `biome check` sạch. KHÔNG sửa hộ (luật 6 — ngoài checklist); fix = `pnpm exec biome check --write scripts/csp-script-hash.mjs` ở nhánh của nó. **→ ĐÃ SỬA trong audit PHA 5 (`audit: F1`) — `pnpm validate` FE xanh lại (mục K).**
- ✅ I3. Honest build (`pnpm build` qua honest-build.mjs, NODE_OPTIONS=--no-experimental-strip-types) với env: API + RPC `/rpc` + passphrase mainnet + rpId + 4 biến chain `PENDING_MAINNET_DEPLOY` + devtools false → **BUILD OK** (8m32s), dist 6.7M.
- ✅ I4. Gate chạy tay trên dist (sau tinh chỉnh D ở trên) — output thật:
  ```
  D2 PASS   (env-DAGGiVZk.js: P_ID:`familyhaven.mscilabs.com`)
  D3 PASS   (0 apex quoted)
  D4.1 PASS (soroban-testnet: 0 hit toàn assets)
  D4.2 PASS (Test SDF/friendbot chỉ trong vendor-stellar-*.js — hằng thư viện)
  D5a PASS (passphrase mainnet trong stellar.toml) · D5b PASS (không Test SDF)
  D5c: template __WEB_AUTH_CONTRACT_ID__ CÒN — ĐÚNG KỲ VỌNG local (sed là bước CI
       sau build; emulation sed → template sạch, đã chạy trong pipeline)
  ```
  Bằng chứng dương tính thêm: bundle chứa `` `Public Global Stellar Network ; September 2015` `` (env + stellar-explorer chunk) và `` api.familyhaven.mscilabs.com/rpc ``. Files `_headers`/`_redirects`/`.well-known/stellar.toml` đều vào dist. **Bundle này chứa PENDING → KHÔNG deploy được; trên CI, D1 chặn từ trước khi build — đúng thiết kế.**
- ✅ I5. BE: `bun run validate` xanh (typecheck + biome 275 file + boundaries + env-parity 41 key + contract hash) · `bun test` toàn bộ: **312 pass, 9 skip (e2e theo thiết kế), 0 fail** — trong đó `/rpc` routes 11 pass (kể cả rate-limit thật 121 req → 429 trên Dragonfly local + CORS preflight) và `ttl-keeper` 4 pass; dry-run thật `fetchWasmHashHex` đọc đúng wasm hash 3 contract testnet qua RPC. **Cập nhật audit PHA 5: 316 pass, 9 skip, 0 fail (+4 test originGuard `/rpc`).**

## K — AUDIT PHA 5 (2026-07-26, nhánh feat/mainnet)

Review 6 vấn đề → soi thật → sửa → chứng minh bằng chạy thật. Commit: `audit: F1…F5`, `audit: S5`, `audit: T6`, `audit: report`.

- **F1** `fe/scripts/csp-script-hash.mjs` biome format — `pnpm validate` FE hết đỏ (gỡ luôn ghi chú I2 ở trên).
- **F2** `/rpc` khoá server-side theo `TRUSTED_ORIGINS` (`be/src/middlewares/origin-guard.ts`): hono/cors KHÔNG chặn request thật cho Origin lạ, /rpc lại nằm ngoài csrf(/api/*). Curl thật: Origin tin cậy → 200; Origin lạ → **403 trước handler**; preflight Origin lạ → 204 KHÔNG kèm Allow-Origin; không Origin (curl/CLI) → qua CÓ CHỦ ĐÍCH.
- **F3** Vá vitest → `pnpm.patchedDependencies` + `fe/patches/vitest@4.1.9.patch` (commit). Gỡ vá chạy thật: `@repo/core` chết 4 file `Timeout waiting for worker to respond` sau 60.15s — fail-env KI-5 thật, không phải lỗi test.
- **F4** D4 ba tầng — miễn trừ CHỈ theo tên file `/vendor-stellar-`; tầng (3) mới quét `.TESTNET` bắt ca app code dùng `Networks.TESTNET` (tầng 2 mù vì passphrase nằm bên vendor chunk). Tiêm lỗi thật: đỏ đúng chunk env-*.js; revert: xanh.
- **F5** Gate mới: dist KHÔNG chứa `PENDING_MAINNET_DEPLOY` (đỏ thật trên build placeholder — build mà bộ gate D2–D5 CŨ cho qua sạch) + D1 assert định dạng (`^C[A-Z2-7]{55}$` / `^[0-9a-f]{64}$`; đỏ với "abc" lẫn PENDING, xanh với giá trị hợp lệ).
- **S5** Comment trong `public/_headers` + `public/stellar.toml` nhắc nguyên văn token `__…__` làm gate template đỏ giả trên build hợp lệ → sửa lời comment, gate giữ nguyên.
- **T6** ttl-keeper lần đầu chạy thật trên testnet — 2 bug chôn (extendTo malformed + trần phí chặn code entry), đã sửa + 4 tx gia hạn thật (xem ĐÍNH CHÍNH mục F).

---

# H1 — GitHub vars phải điền (Settings → Secrets and variables → Actions → Variables)

Gate D1 trong deploy-fe.yml chặn build khi thiếu BẤT KỲ biến nào dưới đây (workflow ĐỎ tới khi điền — đúng thiết kế).

| GitHub vars | Lấy giá trị từ đâu |
|---|---|
| `VITE_SAC_NATIVE` | **Đã có (mục G):** `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` — điền được NGAY |
| `VITE_ACCOUNT_WASM_HASH` | Output `stellar contract upload --wasm target/wasm32v1-none/release/smart_account.wasm --source deployer-mainnet --network mainnet` (sau `stellar contract build` trong `contracts/`) |
| `VITE_WEBAUTHN_VERIFIER_ADDRESS` | Output `contracts/scripts/deploy-origin-verifier.sh` với `RP_ID=familyhaven.mscilabs.com ORIGIN_WEB=https://familyhaven.mscilabs.com ORIGIN_APK=… ORIGIN_EXT=… SOURCE=deployer-mainnet NETWORK=mainnet` (script tự chặn origin dev/localhost) |
| `VITE_RECOVERY_REGISTRY_ADDRESS` | Output `stellar contract deploy --wasm …/recovery_registry.wasm --source deployer-mainnet --network mainnet` |
| `WEB_AUTH_CONTRACT_ID` | Output `stellar contract deploy --wasm …/web_auth.wasm --source deployer-mainnet --network mainnet` (không constructor args) — workflow sed vào stellar.toml |

Điền GitHub vars xong PHẢI điền giá trị BE tương ứng vào VPS (khối H2): `CONTRACT_ID_ORIGIN_VERIFIER` = `VITE_WEBAUTHN_VERIFIER_ADDRESS` · `ACCOUNT_WASM_HASH` = `VITE_ACCOUNT_WASM_HASH` · `SEP45_WEB_AUTH_CONTRACT_ID` = `WEB_AUTH_CONTRACT_ID` · `CONTRACT_ID_RECOVERY` = `VITE_RECOVERY_REGISTRY_ADDRESS` · `CONTRACT_ID_SAC_NATIVE` = `VITE_SAC_NATIVE`. Lệch FE↔BE là challenge SEP-45 bị từ chối / send flow chặn.

# H2 — VPS `deploy/.env.production` delta (làm trên VPS, file KHÔNG có ở local — luật 2)

Sau khi sửa, GATE bắt buộc: `bun run env:check --env-file deploy/.env.production` phải XANH (deploy.sh vốn chạy gate này).

**THÊM/SỬA — BẮT BUỘC ngay (4 biến hết default sau A2, boot chết nếu thiếu):**

```
STELLAR_RPC_URL=<https://mainnet-rpc-provider-url>      # SỬA nếu đang soroban-testnet; provider nhúng key trong URL thì chỉ cần dòng này
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
SEP45_HOME_DOMAIN=familyhaven.mscilabs.com
SEP45_WEB_AUTH_DOMAIN=api.familyhaven.mscilabs.com
```

**THÊM — optional theo cách nạp key (cách 2):**

```
STELLAR_RPC_API_KEY=<rpc-provider-api-key>              # chỉ khi provider dùng key rời; proxy /rpc gửi Authorization: Bearer
```

**THÊM — sau khi deploy contract mainnet (khớp bảng H1):**

```
SEP45_WEB_AUTH_CONTRACT_ID=<C...-web-auth-mainnet>
SEP45_SIGNING_KEY=<S...-mainnet-MỚI>                    # KHÔNG tái dùng key testnet (luật security.md)
CONTRACT_ID_RECOVERY=<C...-recovery-registry-mainnet>
CONTRACT_ID_SAC_NATIVE=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA
CONTRACT_ID_ORIGIN_VERIFIER=<C...-origin-verifier-mainnet>
ACCOUNT_WASM_HASH=<hex64-smart-account-wasm-mainnet>
FEE_WALLET_SECRET=<S...-ví-phí-mainnet>                 # nạp XLM thật; mất ví này chỉ mất tiền phí
INDEXER_CONTRACT_IDS=<C...-recovery-registry-mainnet>   # CSV cho indexer mirror
```

**KIỂM (không sửa mù):**

```
TRUSTED_ORIGINS  # PHẢI chứa https://familyhaven.mscilabs.com — /rpc (CORS) + cookie cùng cần
STELLAR_RPC_FALLBACK_URL  # nếu đang trỏ testnet → XOÁ hoặc thay provider mainnet thứ hai
```

# H3 — BLOCKERS còn lại, theo thứ tự làm

1. **B-MAINNET-1 · Chọn RPC provider mainnet** (user cấp URL ± key) → điền `STELLAR_RPC_URL` (+`STELLAR_RPC_API_KEY`) vào VPS theo H2. Public SDF `https://mainnet.sorobanrpc.com` chỉ đáng để thử — rate-limit công cộng, không SLA.
2. **B-MAINNET-2 · Khoá deploy + ví phí mainnet**: tạo alias `deployer-mainnet` cho stellar-cli (key RIÊNG, không phải key testnet) + ví phí `FEE_WALLET_SECRET` mainnet, nạp XLM thật cho cả hai.
3. **B-MAINNET-3 · Deploy contracts mainnet** theo thứ tự: `stellar contract build` → upload wasm smart-account (ra `ACCOUNT_WASM_HASH`) → `deploy-origin-verifier.sh` (cần `ORIGIN_APK` apk-key-hash + `ORIGIN_EXT` extension id THẬT — script đòi đủ 3 origin; vỏ APK/extension chưa phát hành thì đây là quyết định sản phẩm: chờ, hoặc sửa script nhận danh sách origin linh hoạt — ngoài scope nhiệm vụ này) → deploy recovery-registry → deploy web-auth.
4. **B-MAINNET-4 · SEP45_SIGNING_KEY mainnet mới** → điền VPS (H2) **và THAY `SIGNING_KEY` trong `fe/apps/web/public/.well-known/stellar.toml`** (đang là G testnet dev — có comment BLOCKER tại chỗ trong file).
5. **B-MAINNET-5 · Điền GitHub vars** theo bảng H1 (`VITE_SAC_NATIVE` điền được ngay) + kiểm secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` đã có.
6. **B-MAINNET-6 · Push + deploy** (user làm — nhiệm vụ này KHÔNG push): push `feat/mainnet` → merge main → deploy-fe.yml: D1 xanh khi vars đủ, D2–D5 gate dist, Verify live. BE: VPS pull + env-check GATE + up; smoke `POST /rpc {"jsonrpc":"2.0","id":1,"method":"getHealth"}` từ origin FE.
7. Nợ sẵn có liên quan (không chặn migrate nhưng chặn "SEP-45 chuẩn"): **B-SEP45-1** — BE tách GET/POST hai path, client SEP-45 bên thứ ba sẽ hỏng (ghi trong stellar.toml).

# L — PHA 6: PUSH + DEPLOY BE testnet (2026-07-26)

## L1 — Trạng thái & chốt chặn

- G1 ✅ quét secret 20 commit chưa push (gitleaks 8.30.1 `no leaks` + grep 7 pattern: 0 seed S…, 0 private key, hit còn lại toàn TÊN biến/placeholder/hash công khai).
- G2 ✅ `CONTRACT-DUMP.md` → .gitignore; `pnpm-lock.yaml` gốc (114B, lạc chỗ) đã xoá.
- G3 ✅ deploy-fe.yml tách 2 job: `build-and-gate` (D1–D5, MỌI nhánh) + `deploy` (`if: ref == refs/heads/main`, nhận dist qua artifact `include-hidden-files: true`); concurrency per-ref.
- G4–G6 ⛔ **BLOCKER B-CI-1**: không có đường đọc CI (không GH_TOKEN, repo private → API 404, SSH không phục vụ Actions). Luật PHA 6: *không push mù*. `gh` 2.86.0 ĐÃ cài sẵn `~/.local/bin/gh`.
  **Cần người dùng**: PAT fine-grained (repo `msci2026vn/family-wallet`, quyền Actions:read + Contents:read) → `export GH_TOKEN=<pat>` → phiên sau push + đọc CI được ngay.
- VPS: SSH được bằng alias `vps-phonghoc` (user `cdhc`, host bac-biav / 14.225.198.86 = api.familyhaven.mscilabs.com). `cdhc` thuộc group docker (đọc được trạng thái container) nhưng KHÔNG sudo không-mật-khẩu → mọi bước ghi (V2–V5) cần root: runbook L3.
- Stack `vgd` ĐANG chạy code CŨ (origin/main, image build 2026-07-26T00:48Z): `/rpc` → 404 (baseline đúng); `/ready` → `{"ok":true}` (bản mới sẽ có thêm `watchers` — dùng làm marker deploy thành công). ⚠️ `vgd-worker-1` **unhealthy TỪ TRƯỚC** (Up 13h, healthcheck output rỗng, 0 restart) — điều tra khi deploy.

## L2 — Mốc V1 (đo 2026-07-26 ~13:55 UTC+7, lưu `/tmp/vgd-before.txt` trên VPS — 18 container)

| Domain | GET / | GET /health |
|---|---|---|
| api-os.tranver.com | 401 | 200 |
| api.familyhaven.mscilabs.com | 404 | 200 |
| api.trungtamgiasuskv.com | 404 | 200 |
| api.vapec.vn | 200 | 404 |
| api.vietnamsme.gov.vn | 404 | 200 |

Disk `/`: 28G/49G (58%), còn 21G. Sau deploy: mọi ô của bảng PHẢI GIỮ NGUYÊN.

## L3 — RUNBOOK deploy BE testnet (root trên VPS; CHỈ chạy SAU khi main đã chứa code mới — G6)

```bash
# == V1 phần còn thiếu (đọc) ==
cd /root/apps/family-wallet
git status --porcelain            # kỳ vọng: RỖNG (wrapper mới chạy được)
git rev-parse HEAD                # GHI LẠI = <SHA-TRƯỚC> cho rollback
grep -cE '^[A-Z]' be/deploy/.env.production   # đếm key hiện có (kỳ vọng ~24–29)

# == V2 backup ==
cd be
cp -a deploy/.env.production deploy/.env.production.bak.$(date +%F-%H%M)
ls -lh deploy/.env.production.bak.*           # PHẢI khác 0 byte

# == V3 sửa env (GIÁ TRỊ TESTNET — bảng dưới) ==
$EDITOR deploy/.env.production

# == V4 GATE (fail = DỪNG, không up) ==
export PATH="/root/.bun/bin:$PATH"
bun scripts/env-check.ts --env-file deploy/.env.production
# kỳ vọng: "✅ ENV hợp lệ (…) — đủ 11 biến bắt buộc."  (đã chứng minh bộ delta đủ 11 bằng file mô phỏng local)

# == V5 deploy ==
vgd-deploy.sh                                  # wrapper root: reset về origin/main + be/deploy/deploy.sh
cd /root/apps/family-wallet && git rev-parse HEAD   # PHẢI = SHA merge ở G6
```

### Bảng V3 — delta `be/deploy/.env.production` (TESTNET; đối chiếu env.schema.ts hiện tại)

**THÊM/SỬA (4 biến PROD-REQUIRED mới — thiếu là boot chết fail-closed):**
```
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
SEP45_HOME_DOMAIN=familyhaven.mscilabs.com
SEP45_WEB_AUTH_DOMAIN=api.familyhaven.mscilabs.com
```
**KIỂM — phải CÓ SẴN đúng giá trị testnet (thiếu dòng nào thì thêm; secret lấy từ nguồn của người vận hành, KHÔNG commit).
ID = đợt deploy 2026-07-27 (AUDIT-2026-07-25 §8 — bộ CAKV3MKK/CAFU4CZN/CAN4LHSY cũ ĐÃ BỎ):**
```
TRUSTED_ORIGINS=…phải chứa https://familyhaven.mscilabs.com…
SEP45_WEB_AUTH_CONTRACT_ID=CBWMHVEEXEOSOSWULYNYN62EYVMWJT55NKRPUI2MXSYHVVZ6NIMRJBWD
SEP45_SIGNING_KEY=<S...-testnet-sep45-signing>
CONTRACT_ID_RECOVERY=CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR
CONTRACT_ID_SAC_NATIVE=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
INDEXER_CONTRACT_IDS=CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR
FEE_WALLET_SECRET=<S...-ví-phí-testnet — ví GCJT4UD4II6H…GMFE đang có 9975+ XLM>
```
**THÊM (optional — để ttl-keeper phủ đủ hạ tầng, giá trị CÔNG KHAI; bản deploy-từ-artifact 2026-07-29, StellarExpert verified):**
```
CONTRACT_ID_ORIGIN_VERIFIER=CBFCNHIOQN3N5IVSIVW4TTKYXZ73YQI4DZPADC6UCWF2XU35W4GVVWGW
ACCOUNT_WASM_HASH=c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f
```
**XOÁ:**
```
mọi dòng ^R2_            # đã gỡ hẳn khỏi schema (B-ENV-1)
STELLAR_RPC_API_KEY      # bỏ trống/xoá — testnet công khai không cần key
STELLAR_RPC_FALLBACK_URL # xoá nếu trỏ linh tinh; testnet không cần
```

### V6 — verify sau deploy (6 mục, output thật)
```bash
# a) hàng xóm nguyên trạng
docker ps --format '{{.Names}}\t{{.Status}}' | sort > /tmp/vgd-after.txt && diff /tmp/vgd-before.txt /tmp/vgd-after.txt
for d in api-os.tranver.com api.trungtamgiasuskv.com api.vapec.vn api.vietnamsme.gov.vn; do curl -s -o /dev/null -w "$d %{http_code}\n" "https://$d/"; done
# kỳ vọng: 401 · 404 · 200 · 404 (khớp bảng L2); diff chỉ được khác các dòng vgd-*
# b) backup wrapper khác 0 byte: ls -lh deploy/.env.production.bak.*
# c) /rpc pass-through (marker code mới + đúng env testnet):
curl -sS -X POST https://api.familyhaven.mscilabs.com/rpc -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork"}'
# kỳ vọng: {"jsonrpc":"2.0","id":1,"result":{"passphrase":"Test SDF Network ; September 2015",…}}
curl -s https://api.familyhaven.mscilabs.com/ready    # kỳ vọng có "watchers":{"recoveryWatch":"enabled","push":…}
# d) CORS 3 ca:
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api.familyhaven.mscilabs.com/rpc -H 'Origin: https://familyhaven.mscilabs.com' -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'   # 200
curl -s -X POST https://api.familyhaven.mscilabs.com/rpc -H 'Origin: https://evil.example.com' -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' -w ' %{http_code}\n'                       # 403 ORIGIN_NOT_ALLOWED
curl -s -X POST https://api.familyhaven.mscilabs.com/rpc -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getLedgers"}'   # {"error":{"code":-32601 METHOD_NOT_ALLOWED}} — không forward
# e) ttl-keeper: cron đăng ký + chạy tay 1 lượt
docker exec vgd-worker-1 bun -e 'import {ttlKeeperQueue} from "./src/jobs/ttl-keeper"; console.log(await ttlKeeperQueue.getRepeatableJobs())'   # pattern "0 3 * * *" tz UTC
docker exec vgd-app-1 bun run scripts/ttl-keeper-once.ts    # dán TTL trước/sau + result; tx hash: https://stellar.expert/explorer/testnet/account/GCJT4UD4II6H3FDWPWFH5D5B7CVDOLJZXDVV6VSNQ4GJQK4EYMGHGMFE
# f) dispatcher: tạo 1 notification thật (INSERT qua app hoặc luồng recovery test) rồi chứng minh mail ĐI:
#    log PROVIDER (Resend dashboard → Emails → status delivered), KHÔNG phải log app.
#    Không có Resend key production/testnet thật → ghi ⛔, đừng ✅.
```

### V7 — ROLLBACK (viết sẵn TRƯỚC khi deploy)
```bash
# (1) Khôi phục env từ backup V2:
cd /root/apps/family-wallet/be
cp -a deploy/.env.production.bak.<timestamp> deploy/.env.production
# (2) Rollback code — forward-only (KHÔNG force-push): revert merge trên main rồi deploy lại
git -C /root/apps/family-wallet revert -m 1 <SHA-merge-G6> && git push origin main   # (làm ở máy dev nếu VPS không có quyền push)
vgd-deploy.sh                       # wrapper reset về origin/main (= bản revert) + build + up
# (3) Xác nhận: git rev-parse HEAD = <SHA-TRƯỚC ghi ở V1>; curl /health + /ready 200; bảng L2 nguyên trạng.
# Migration là forward-only additive — KHÔNG rollback schema; bản cũ chạy được trên schema mới (expand-contract).
```
