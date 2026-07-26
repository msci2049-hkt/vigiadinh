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

- ✅ D1. Step "Gate mainnet vars (D1)" trước Build: fail + echo đúng TÊN biến thiếu cho 4 biến chain + `WEB_AUTH_CONTRACT_ID`. Cố ý fail-loud (khác skip-deploy của CF secrets): workflow sẽ ĐỎ tới khi điền GitHub vars — đúng thiết kế.
- ✅ D2. `grep -rqE "${Q}familyhaven\.mscilabs\.com${Q}"` (Q=`['"]`) trên dist/assets — PHẢI có (thay gate rpId cũ không-quote)
- ✅ D3. `grep -rqE "${Q}mscilabs\.com${Q}"` — PHẢI KHÔNG có (apex quoted; `"familyhaven.mscilabs.com"` không dính vì trước `mscilabs` là dấu chấm)
- ✅ D4. `soroban-testnet|Test SDF Network|friendbot` — PHẢI KHÔNG có trong dist/assets. Kéo theo: sửa message lỗi env.ts (A1) bỏ literal giá trị testnet (nó bị nướng vào bundle → tự làm D4 đỏ); message giờ trỏ `.env.example`/`env.production.example`. Đã rg toàn src (loại *.test.*): 0 tripwire còn lại.
- ✅ D5. dist stellar.toml: PHẢI có passphrase mainnet; PHẢI KHÔNG có `__WEB_AUTH_CONTRACT_ID__`/`Test SDF`. Placeholder-check toàn dist thêm `__WEB_AUTH_CONTRACT_ID__`.
- ✅ D-localhost: **BỎ gate cứng, có ghi chú trong workflow** — guard fail-closed của env.ts (`=== "localhost"` + message) tự chứa literal `"localhost"` trong bundle → false-positive chính đáng. Giữ cảnh báo mềm in context; D2/D3 vẫn là gate cứng cho rpId.
  - File: `.github/workflows/deploy-fe.yml` (step D1 + khối Verify dist) · `fe/apps/web/src/lib/env.ts` (message)

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

- ☐ I1. Xoá node_modules FE → `pnpm install --frozen-lockfile`
- ☐ I2. `pnpm validate` + `pnpm test` (fail có sẵn → dán nguyên văn)
- ☐ I3. Build local đủ env (passphrase mainnet, RPC /rpc, rpId, 4 biến chain = PENDING_MAINNET_DEPLOY, NODE_OPTIONS=--no-experimental-strip-types)
- ☐ I4. Chạy tay gate D2→D5 trên dist — dán output thật (bundle chứa PENDING → KHÔNG deploy được, D1 CI chặn đúng thiết kế)
- ☐ I5. BE: test /rpc + ttl-keeper — dán kết quả

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
