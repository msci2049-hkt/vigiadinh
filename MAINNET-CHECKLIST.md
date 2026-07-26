# MAINNET-CHECKLIST — testnet → mainnet (PHA 3+4, 2026-07-26)

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

- ☐ D1. Trước Build: fail nếu rỗng 4 biến chain + WEB_AUTH_CONTRACT_ID (echo tên biến thiếu)
- ☐ D2. dist/assets PHẢI có `['"]familyhaven\.mscilabs\.com['"]`
- ☐ D3. dist/assets KHÔNG có `['"]mscilabs\.com['"]`
- ☐ D4. dist/assets KHÔNG có `soroban-testnet|Test SDF Network|friendbot`
- ☐ D5. dist stellar.toml: CÓ passphrase mainnet, KHÔNG `__WEB_AUTH_CONTRACT_ID__`/`Test SDF`
- ☐ D-localhost: thêm nếu không false-positive từ guard clause env.ts; dính thì bỏ + ghi lý do

## E — GUARD E2E

- ☐ E. 2 file onchain.e2e.test.ts: throw ngay khi passphrase mainnet, kể cả RUN_TESTNET_E2E=1

## F — TTL-KEEPER PHỦ NỐT

- ☐ F. origin-verifier + web-auth + WASM code entries vào vòng gia hạn cron; env mới theo convention; test chứng minh

## G — DERIVE VITE_SAC_NATIVE

- ☐ G. `stellar contract id asset --asset native` passphrase mainnet → ghi kết quả vào mục GitHub vars

## H — DOCS CHỐT

- ☐ H1. Bảng "GitHub vars phải điền"
- ☐ H2. Khối "VPS .env.production delta"
- ☐ H3. BLOCKERS còn lại theo thứ tự làm

## I — VERIFY TOÀN CỤC

- ☐ I1. Xoá node_modules FE → `pnpm install --frozen-lockfile`
- ☐ I2. `pnpm validate` + `pnpm test` (fail có sẵn → dán nguyên văn)
- ☐ I3. Build local đủ env (passphrase mainnet, RPC /rpc, rpId, 4 biến chain = PENDING_MAINNET_DEPLOY, NODE_OPTIONS=--no-experimental-strip-types)
- ☐ I4. Chạy tay gate D2→D5 trên dist — dán output thật (bundle chứa PENDING → KHÔNG deploy được, D1 CI chặn đúng thiết kế)
- ☐ I5. BE: test /rpc + ttl-keeper — dán kết quả
