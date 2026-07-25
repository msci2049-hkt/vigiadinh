# BLOCKERS

Việc KHÔNG tự làm xong được trên máy hiện tại. Mỗi mục ghi: chặn cái gì, vì sao,
cần ai/cái gì để gỡ. Không mục nào ở đây được coi là "đã xanh".

> ⚠️ **MỌI SHA ghi trước 2026-07-24 trong file này KHÔNG CÒN HIỆU LỰC** — lịch sử đã rewrite
> 2026-07-23 (gộp scaffold, 136 → 16 commit; cây làm việc không đổi một byte).
> Chi tiết + bảng tra: `BUILD-LOG.md` đầu file. Lịch sử cũ nằm ngoài repo:
> `../family-wallet-backup-full.bundle` (repo chỉ còn nhánh `main`).

## Audit toàn diện 2026-07-25 — P1 CÒN MỞ

Nguồn: `docs/security/AUDIT-2026-07-25.md`. 7 lỗ hổng P0 đã vá kèm test hồi quy.
Năm mục dưới đây **chưa vá** và phải xong trước mainnet.

### CẬP NHẬT closeout 2026-07-25 (đợt 2) — trạng thái sau phiên đóng

| Mục | Trạng thái | Commit | Test hồi quy |
|---|---|---|---|
| **B-SEC-1** `recovery_rotate` thêm-trước-xoá | ✅ **ĐÓNG** — xoay neo nguyên tử | `fix(contracts)!: rotate recovery keys atomically` | `recovery_rotate_survives_a_wallet_full_of_15_signers` (đỏ trên bản cũ: panic #3010 TooManySigners) |
| **B-SEC-2** TTL bỏ sót `SignerData` | ✅ **ĐÓNG** — extend đúng `SignerData(id)`+`SignerLookup(hash)`; durability = **persistent** (archive **cứu được**, mất ví TẠM THỜI → mức 🟠, không 🔴) | `fix(contracts): extend TTL of the owner passkey` | `extend_ttl_reaches_the_owner_passkey_signer_entry` (đỏ trên bản cũ: SignerData 518400 ≠ rule 700000) |
| **B-SEC-3** ttl-keeper phí ví không trần | ⚠️ **VÁ MỘT PHẦN** — thêm trần phí per-tx `FEE_CAP_EXCEEDED` + `LIMIT` mỗi tick. **CÒN**: chỉ nên gia hạn ví `is_registered` (chưa lọc theo registry) | `fix(be): cap the fee wallet's per-tx spend` | `assertFeeWithinCap` (4 ca) |
| **B-SEC-4** audit_log không chặn TRUNCATE | ⚠️ **VÁ MỘT PHẦN** — trigger `BEFORE TRUNCATE FOR EACH STATEMENT` (0008). **CÒN**: app chạy bằng role sở hữu bảng → `DROP TRIGGER` được; cần tách role INSERT/SELECT (hạ tầng deploy) | `fix(be): block TRUNCATE on the append-only audit log` | `audit-append-only.integration.test.ts` ca TRUNCATE (đỏ khi drop trigger 0008) |
| **B-SEC-5** ký mù `guardian/approve` + `block/confirm` | ✅ **ĐÓNG** — `assertApproveRecoveryEntry`/`assertCancelRecoveryEntry`, mốc = state cục bộ (registry env + ví từ inbox/active) | `fix(fe): stop blind-signing on guardian approve and block confirm` | `auth-entry-guard.test.ts` +7 ca (transfer đội lốt approve/veto bị chặn) |
| §4.4 origin-verifier DEV localhost | ⚠️ **VÁ MỘT PHẦN** — deploy script fail-closed chặn localhost/non-https/wildcard + đổi `.expect()`→`panic_with_error!` (C2). **CÒN**: instance testnet đang chạy vẫn là DEV; production chạy `deploy-origin-verifier.sh` với domain thật (HUMAN-TODO) | `fix(contracts): coded errors on the verifier hot path` | `malformed_sig_data_never_verifies` + guard script (empty→rc1, localhost→chặn) |
| CI đỏ `cargo fmt --check` (do vá P0 `ae7c855`) | ✅ **ĐÓNG** | `ci(contracts): rustfmt the recovery expiry guard` | `cargo fmt --check` xanh |

Chi tiết §B-SEC-1..5 gốc giữ nguyên bên dưới để đối chiếu.

### B-SEC-1 · `recovery_rotate` thêm signer TRƯỚC khi xoá → khôi phục hỏng vĩnh viễn

- **Chặn:** ví đã nối đủ 15 thiết bị (trần `MAX_SIGNERS` của OZ) thì khôi phục **panic
  `TooManySigners`** và revert cả tx. Yêu cầu đứng `Approved` mãi, `initiate_recovery`
  bị chặn bởi `RecoveryInProgress` → ví không bao giờ cứu được nữa.
- **Ở đâu:** `contracts/smart-account/src/lib.rs:227-230`.
- **Cần gì:** đổi sang xoá-trước-thêm, và một test dựng đủ 15 signer rồi khôi phục.
  Cùng lớp: OZ panic `validate_no_canonical_duplicates` nếu khoá mới trùng khoá đang có.

### B-SEC-2 · TTL keeper bỏ sót `SignerData`/`SignerLookup` → đường "6 tháng sau" chết

- **Chặn:** `extend_ttl` chỉ gia hạn instance + `ContextRuleData`. Passkey chủ ví nằm ở entry
  persistent RIÊNG của OZ, chỉ được gia hạn **khi có người đọc**, và chỉ tới 30 ngày — trong khi
  ví thừa kế sinh ra để nằm im hàng tháng. Quá 30 ngày không ai ký → `SignerData` archive →
  `__check_auth` chết. Cron **không sửa được** sau đó (entry đã archive cần `RestoreFootprint`).
- **Ở đâu:** `contracts/smart-account/src/lib.rs:191-199`; test `test.rs:349` chỉ kiểm gọi được,
  không hề warp qua mốc TTL.
- **Cần gì:** `extend_ttl` đọc rule để chạm đúng `SignerData(id)`/`SignerLookup`, + test warp
  quá 30 ngày rồi ký lại.

### B-SEC-3 · `ttl-keeper` cho ví phí trả cho contract do người dùng khai

- **Chặn:** `POST /api/wallets` nhận bất kỳ chuỗi `C…` nào, không chứng minh quyền sở hữu. Cron
  sau đó gọi `extend_ttl` lên **mọi** dòng, không `LIMIT`, và `invokeWithSignedEntries` lấy
  resource fee thẳng từ simulation — **không trần phí**. Kẻ tấn công deploy contract
  `extend_ttl` ngốn tài nguyên rồi đăng ký là ví phí trả dài hạn.
- **Cần gì:** chỉ gia hạn ví đã `is_registered` trên registry, trần phí mỗi tx, phân trang.

### B-SEC-4 · `audit_log` append-only KHÔNG chặn TRUNCATE

- **Chặn:** trigger là `FOR EACH ROW BEFORE UPDATE OR DELETE`; trigger dòng **không bao giờ bắn
  khi TRUNCATE**. `TRUNCATE audit_log;` xoá sạch nhật ký mà trigger vẫn nguyên. Ngoài ra app
  connect bằng chính role sở hữu bảng nên `DROP TRIGGER` cũng chạy được.
- **Ở đâu:** `be/drizzle/0002_audit-append-only.sql:12-14`.
- **Cần gì:** thêm trigger `BEFORE TRUNCATE ... FOR EACH STATEMENT`, và cho app một role chỉ
  có INSERT/SELECT trên bảng này.

### B-SEC-5 · Ký mù còn mở ở `guardian/approve` và `block/confirm`

- **Chặn:** hai màn này vẫn ký entry backend đưa mà không giải mã đối chiếu. `approve` nguy hơn:
  nó hiện fingerprint lấy từ **mirror do chính backend ghi**, và `chainTruthOptions` đã có sẵn
  nhưng không được dùng.
- **Cần gì:** gắn `lib/auth-entry-guard.ts` + đọc `chain-truth` làm mốc đối chiếu.

### B-SEC-6 · Chưa có fuzz, chưa chạy được Scout

- **Chặn:** không có `fuzz/`, không target nào cho `__check_auth`/`finalize_recovery`.
  `cargo-scout-audit` cài được nhưng `openssl-sys` cần `pkg-config` + header OpenSSL; máy chỉ có
  `.so` runtime, không sudo. Đã thay bằng `cargo clippy` đúng nhóm lint (25 hit, phân loại từng
  cái) — **không phải vật thay thế tương đương**.
- **Cần gì:** máy có OpenSSL dev + `cargo-fuzz`, hoặc chạy Scout trong container.

### B-SEC-7 · Contract đã đổi shape → mọi bằng chứng e2e cũ hết hiệu lực

- **Chặn:** `RecoveryRequest` thêm `expires_at`; thêm mã lỗi 17 (`TimelockTooShort`),
  18 (`RequestExpired`), 108 (`CooldownTooLong`); sàn mới `MIN_GUARDIANS=3`,
  `MIN_THRESHOLD=2`, `MIN_TIMELOCK_SECS=86400`, `MAX_COOLDOWN_SECS=7 ngày`.
  9 test e2e vẫn skip vì thiếu `RUN_TESTNET_E2E=1` + Postgres + `FEE_WALLET_SECRET` + contract ID.
- **Cần gì:** deploy lại contract lên testnet, cập nhật contract ID, chạy lại e2e thu tx hash.
  **Ví đã đăng ký bằng bản cũ không tự động đạt sàn mới** — cần rà lại.

### B-SEC-9 · 🟠 Lỗ test do `cargo-mutants` phát hiện (closeout 2026-07-25)

- `cargo mutants -p smart-account`: 46 mutant → **24 caught / 10 missed / 12 unviable**. Các fix
  đợt này (`recovery_rotate`, `extend_ttl`) **đều bị BẮT** (nằm trong 24 caught) — test hồi quy thật.
- **10 mutant sống là lỗ test CÓ SẴN**, không phải hồi quy đợt này:
  - `__check_auth` (lib.rs:301 `-> Ok(())`; :312 `<`→`==`/`>`/`<=`) — **cổng cooldown #101 KHÔNG có
    unit test ở crate smart-account** (test.rs cố ý bỏ __check_auth vì cần dựng AuthPayload/crypto;
    cooldown chỉ được phủ gián tiếp). Đây là mutant quan trọng nhất — biên cửa sổ cooldown chưa khoá.
  - `last_rotation` getter (lib.rs:238), `owner_rule_id -> 0` (lib.rs:84, luôn 0 trong test),
    `registry_link` store/apply_pending biên `>`/`<` (:96, :136).
- **Cần gì:** test __check_auth cooldown ở mức dựng được AuthPayload tối thiểu (panic #101 TRƯỚC crypto),
  + test biên `last_rotation + cooldown`. Ưu tiên trung bình (cooldown đã phủ ở tầng e2e/đọc chain,
  nhưng biên chưa khoá bằng unit test).

### B-SEC-8 · `pnpm audit --audit-level=high` — ✅ ĐÃ GỠ (closeout 2026-07-25)

- **Đã vá bằng `pnpm.overrides` có chủ đích** (không hạ `--audit-level`): `brace-expansion: 5.0.8`
  (bản `latest` đã vá ReDoS GHSA-mh99-v99m-4gvg; `^2.0.2` resolve nhầm sang `2.1.2 =
  maintenance-v2` vẫn dính, nên pin thẳng 5.0.8) + `postcss: ^8.5.18` (vá path-traversal source-map).
  Sau override: `pnpm audit --audit-level=high` → **rc=0** (0 high, còn 3 moderate không gate).
  Cả hai chỉ ở build-tooling (vite/vitest/workbox/sentry), không vào bundle. Build honest + validate
  + test chạy lại XANH với lockfile mới.
- **Còn 3 moderate** (không chặn gate high) — theo dõi, bump khi upstream ra bản sạch.

## CI (2026-07-23, sau SHA `e2682fd`)

### B-CI-1 · Không đọc được kết quả GitHub Actions từ máy này

- **Chặn:** không tự xác nhận được 4 workflow xanh trên `main` sau khi push.
- **Vì sao:** máy không có `gh` CLI và không có `GITHUB_TOKEN`/`GH_TOKEN` trong env.
  Đã thử cả hai đường trong quy trình (§1 gh, §1b curl API) — không đường nào dùng được.
- **Đã làm thay thế:** tái hiện local ĐÚNG lệnh và ĐÚNG version CI pin cho mọi gate chạy
  được (bảng bằng chứng trong `BUILD-LOG.md` §CI). 3 nguyên nhân đỏ tìm được đều đã sửa
  và verify lại bằng chính lệnh của CI.
- **Cần để gỡ:** người mở tab Actions của `msci2026vn/family-wallet` xem run của
  `e2682fd`; hoặc cài `gh` + `gh auth login`; hoặc đặt `GITHUB_TOKEN` (scope `repo`) vào env.

### B-CI-2 · Job e2e (ci-fe.yml) chưa từng verify được ở máy local

- **Chặn:** không khẳng định được e2e xanh. **Không có bằng chứng nó hỏng, cũng không có
  bằng chứng nó chạy được** — đúng nghĩa chưa biết.
- **Vì sao:** fail-env đã biết (KI-2): chromium/headless-shell thiếu `libnspr4`, `libnss3`,
  `libasound2`; máy không có `sudo` nên không chạy được `playwright install-deps`.
  Marker `DEPENDENCIES_VALIDATED` trong `~/.cache/ms-playwright` là marker CŨ, đừng tin.
- **Đã kiểm tra tĩnh (không đủ để kết luận xanh):** `ci-fe.yml` đã dùng
  `playwright install --with-deps chromium firefox webkit` (runner GitHub có sudo), và
  `@playwright/test` là 1.61.0 — bản này đã biết Ubuntu 24.04/noble nên `--with-deps` cài
  `libasound2t64` đúng tên mới. Tức nghi phạm "thiếu system deps" của checklist đã được
  workflow xử lý sẵn; nhưng CHƯA CHẠY thì chưa được nói là xanh.
- **Số test e2e kỳ vọng:** 19 (baseline 20, lô 4 khai báo bỏ 1 test health-badge cùng màn demo),
  nhân 3 browser (chromium/firefox/webkit) theo `playwright.config.ts`.
- **Cần để gỡ:** đọc kết quả job `e2e` ở CI (xem B-CI-1). Muốn chạy local thì cần sudo:
  `sudo pnpm --filter @repo/web exec playwright install-deps`.
- **Bẫy đã dính một lần, đừng dính lại:** `playwright test | tail -N` → exit code là của
  `tail` (luôn 0). Phải đọc NỘI DUNG dòng summary passed/failed.

### B-CI-3 · Nhánh matrix Node 24 của ci-fe chưa chạy local

- **Chặn:** 1/3 nhánh matrix `validate-test-build` chưa được tái hiện.
- **Vì sao:** máy chỉ có Node 20.20.2 và 22.23.1 (nvm), chưa cài 24. Gate đã chạy bằng 22.
- **Rủi ro thực tế:** thấp — nhánh 24 tồn tại để chặn việc Node 24 tự strip type che mất
  import `.ts` chéo package trong file host-loaded, mà guard `scripts/check-host-loaded.mjs`
  đã kiểm việc đó độc lập với runtime và ĐÃ XANH.
- **Cần để gỡ:** `nvm install 24` rồi chạy lại chuỗi gate với
  `NODE_OPTIONS=--no-experimental-strip-types`; hoặc đọc kết quả nhánh 24 ở CI.

### Không phải blocker (đã loại trừ trong phiên scan)

- `check:contract` — xanh, `shared/` khớp bản copy be/ + fe/.
- `knip` — KHÔNG phải gate CI (không xuất hiện trong workflow nào, không nằm trong chuỗi
  `validate` của cả hai bên) → không thể là nguyên nhân đỏ.
- Toolchain Rust — `contracts/Cargo.toml` đặt `rust-version = "1.91.0"` (mức TỐI THIỂU),
  CI dùng `dtolnay/rust-toolchain@stable` (hiện 1.97.1) nên thoả; `wasm32v1-none` đã khai
  trong workflow. `cargo fmt --check` + `cargo test --workspace` 15/15 + `stellar contract
  build` đều xanh local.
- Asset tải trong workflow — cả hai URL còn sống (HTTP 200): stellar-cli 27.0.0 và
  gitleaks 8.30.1.

## Máy dev

### B-DEV-1 · ĐÃ GỠ ✅ (2026-07-25) — gitleaks local đã lên 8.30.1

Nâng xong (`gitleaks version` → 8.30.1). Nâng xong LẠI LỘ chuyện lớn hơn: chạy đúng lệnh
CI thì **job `secret-scan` đang ĐỎ ở `a460465`** với 7 finding — không cái nào là secret
(địa chỉ hợp đồng `C…`, khoá CÔNG KHAI của extension, hash chứng chỉ APK công bố trong
`assetlinks.json`). Đã vá bằng 3 `[[allowlists]]` theo GIÁ TRỊ; sau vá `no leaks found`.
Chi tiết + probe chứng minh seed `S…` vẫn bị bắt: BUILD-LOG §AUDIT 2026-07-25.

<details><summary>Ghi chép gốc</summary>

### B-DEV-1 · gitleaks local (8.24.3) lệch bản CI (8.30.1) → pre-commit báo nhầm

- **Triệu chứng:** sau commit `91eeb57`, hook pre-commit chạy bằng gitleaks 8.24.3 sẽ báo
  2 false-positive (fixture `test-secret-*` trong `be/src/lib/cdhc-jwt.test.ts` và endpoint
  RPC Liquify public trong `.claude/skills/.../rpc-providers.md`).
- **Vì sao:** bản < 8.25 bỏ qua bảng `[[allowlists]]` một cách IM LẶNG. Bảng `[allowlist]`
  số ít từng được thêm để bù việc đó, nhưng chính nó làm 8.30.1 ở CI chết — nên đã gỡ.
  Không thể chiều cả hai bản cùng lúc; CI pin 8.30.1 là bản đúng.
- **Cần để gỡ:** nâng binary local lên đúng bản `be/docs/HUMAN-TODO.md` §2 đã yêu cầu sẵn:
  ```bash
  curl -sL -o /tmp/g.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
  tar -C /tmp -xzf /tmp/g.tar.gz gitleaks && mv /tmp/gitleaks ~/.local/bin/gitleaks
  gitleaks version   # → 8.30.1
  ```

</details>

## PHA 5–7 (2026-07-24)

### B-52-1 · E2e FE chỉ chạy chromium — firefox/webkit CHƯA AI chạy

- **Chặn:** không khẳng định được luồng passkey/SEP-45 chạy trên firefox/webkit.
- **Vì sao:** spec passkey (`fe/apps/web/e2e/passkey-login.spec.ts`) chủ ý chỉ project
  chromium vì chạm testnet THẬT (giảm bề mặt flake ×3); hai browser kia của matrix
  playwright chưa từng chạy spec này ở đâu (local fail-env KI-2, CI không đọc được B-CI-1).
- **Cần để gỡ:** đọc job e2e ở CI; khi có máy đọc CI, cân nhắc chạy passkey spec thêm
  firefox/webkit định kỳ (không mỗi push) để giữ flake thấp mà vẫn có phủ.

### B-52-2 · Issue upstream js-xdr chưa mở được từ máy này

- **Chặn:** bug `js-xdr 4.0.0 toXDR` (tự tìm ra, PHA 2.3) chưa báo upstream.
- **Vì sao:** máy không có `gh`/`GITHUB_TOKEN` (B-CI-1).
- **Đã làm thay thế:** draft đầy đủ (title + body EN + repro + workaround) ở
  `docs/upstream/js-xdr-toXDR-issue.md` — người có GitHub dán là xong.

## PHA 2.3 (2026-07-24)

### B-23-1 · E2e passkey (`fe/apps/web/e2e/passkey-login.spec.ts`) chưa chạy được local

- **Chặn:** không tự xác nhận được e2e passkey xanh trên máy này.
- **Vì sao:** fail-env cũ (KI-2 — chromium thiếu libnspr4/libnss3/libasound2, không sudo).
- **Đã làm thay thế:** viết spec theo API `.d.ts` Playwright 1.61 đã cài
  (`context.credentials.install()` + mock BE qua `page.route` — đúng triết lý e2e repo);
  luồng ký FE phủ bằng 10 unit test (vitest) + BE phủ 19 test + smoke sống.
- **Cần để gỡ:** đọc job e2e ở CI sau push (xem B-CI-1). LƯU Ý: spec này gọi RPC
  **testnet thật** trong `kit.createWallet` (simulate deploy) — chỉ chạy chromium để
  giảm bề mặt flake; nếu CI đỏ vì network testnet thì đó là flake hạ tầng, ghi lại đây.

### B-23-2 · Tương thích smart-account-kit ↔ contract OZ 0.7.2 của ta CHƯA verify on-chain

- **Chặn:** chưa chứng minh KIT (đường passkey WebAuthn) ký được tx mà `__check_auth` của
  `contracts/smart-account` chấp nhận.
- **ĐÃ THU HẸP NHIỀU (audit P0 2026-07-24):** e2e BE chứng minh TRÊN TESTNET rằng format
  AuthPayload + digest OZ (`sha256(payload ++ scvVec(rule_ids).toXDR())`) mà kit dùng
  (kit .d.ts `computeEntryAuthDigest` — ĐÚNG công thức này) được contract của ta chấp nhận —
  ký tay External(ed25519) qua đường đó SUCCESS trên chain (docs/evidence §AUDIT P0).
  Rủi ro còn lại chỉ là nhánh WebAuthn: encode WebAuthnSigData + origin-verifier
  (đã có cargo test crypto thật ở origin-verifier, còn thiếu bản chạy browser thật).
- **Dấu hiệu sẽ lộ:** e2e passkey CI (giờ simulate deploy bằng wasm hash MỚI `a67ea40e…` —
  fe/.env.example đã trỏ) fail ở bước ký/submit.
- **Cần để gỡ:** đọc job e2e ở CI (B-CI-1).

## CẬP NHẬT 2026-07-24 (phiên đóng mắt xích passkey)

### B-23-2 · ĐÃ ĐÓNG ✅ — kit ↔ contract OZ verify on-chain bằng passkey THẬT
- Bằng chứng: tx `e83adb27…` — WebAuthn secp256r1 (virtual authenticator, ceremony
  navigator.credentials thật) ký SAC transfer qua `__check_auth` → origin-verifier,
  settled testnet. `docs/evidence/TESTNET.md §PASSKEY-ONCHAIN`.
- Rủi ro "kit ↔ OZ đường WebAuthn" hiện hình thành 2 bug sản phẩm (contextRuleIds +
  scvVoid placeholder) — ĐÃ vá + test (BUILD-LOG §1 PASSKEY ON-CHAIN, RESEARCH-LOG).

### B-CI-2 · THU HẸP — e2e chromium ĐÃ chạy local (firefox/webkit còn nguyên)
- Workaround không cần sudo: `apt-get download libnspr4 libnss3 libasound2t64` →
  `dpkg -x` vào `~/chrome-libs/extracted` → `LD_LIBRARY_PATH=~/chrome-libs/extracted/usr/lib/x86_64-linux-gnu`.
- Suite chromium local: **23 pass / 1 skip / 0 fail** (2026-07-24). Kết quả CI GitHub
  vẫn chưa đọc được từ máy này (B-CI-1 còn nguyên); firefox/webkit chưa thử vá lib
  tương tự (B-52-1 còn nguyên).

### B-23-1 · CẬP NHẬT — spec passkey-login skip CÓ CHỦ ĐÍCH
- Chạy local lần đầu lộ: spec không thể xanh với kit 0.4.2 — `signAuthEntry` đọc
  `get_context_rule` TỪ CHAIN để tìm signer, ví do `createWallet` (không autoSubmit)
  chưa tồn tại on-chain → ký luôn fail. Spec giờ `test.skip` kèm lý do trong file;
  bằng chứng passkey chuyển sang `passkey-onchain.spec.ts` (opt-in RUN_TESTNET_E2E,
  đã pass local). Việc treo: e2e đăng-nhập-lại với ví ĐÃ deploy (cần fixture
  credential ổn định) + đổi /passkey createCta trỏ về /setup (§2.5).

### B-52-1 · CẬP NHẬT 2026-07-24 — e2e chạy local CHROMIUM + FIREFOX; webkit còn hở

- **Tiến triển:** với workaround `LD_LIBRARY_PATH=~/chrome-libs/extracted/...` (apt-get
  download libnspr4/libnss3/libasound2t64 + dpkg -x, KHÔNG cần sudo), e2e không-mạng
  `family-screens.spec.ts` chạy local **chromium 6 pass + firefox 6 pass** (2026-07-24).
  Firefox binary tải thêm qua `playwright install firefox` (deps-validate lỗi vì thiếu
  sudo nhưng binary vẫn tải; libs của firefox đã đủ nhờ LD_LIBRARY_PATH trên).
- **Webkit còn fail-env:** đòi cả stack GTK4 (~30 .so: libgtk-4, libgraphene, libicu-78,
  gstreamer*, libwebp…) + cây phụ thuộc lớn — tải hết không cân xứng công sức. Spec
  network-free + API chuẩn cross-browser (đã chứng minh trên 2 engine) → rất khả năng
  xanh trên CI (runner có `--with-deps`). Chưa chạy local thì chưa gọi là xanh.
- **Cần để gỡ:** đọc job e2e CI (B-CI-1), hoặc `sudo playwright install-deps webkit`.

## §3 QUÉT "CHỈ TEST GỌI" — 2026-07-24 (bảng đầy đủ: `docs/COVERAGE-PRODUCT.md`)

Lớp lỗi: hàm contract đã cài + đã test on-chain nhưng KHÔNG đường sản phẩm nào chạm tới.
Hai P0 tìm được đã VÁ trong phiên (`set_recovery_registry` → constructor · `extend_ttl`
→ hàm contract + cron `ttl-keeper`). Các mục dưới là phần CHƯA dựng, ghi lý do:

### B-COV-1 · `remove_guardian` chưa có đường sản phẩm
- **Chặn:** không thay được người bảo hộ đã mất liên lạc. `/night-watch/resolve` hiện chỉ là
  hướng dẫn bằng chữ ("nhờ mở app / thay người"), chưa có nút hành động.
- **Vì sao chưa làm:** gỡ guardian là đổi-quyền chạm custody, phải đi qua đúng luồng có
  timelock + chống lockout (contract đã chặn rớt dưới threshold). Cần màn xác nhận riêng.
- **Cần để gỡ:** dựng màn thay-người ở cụm GHI, cùng khuôn `/block` (fingerprint + biometric).

### B-COV-2 · Đổi registry (propose/apply/veto) chưa có UI
- **Chặn:** không di cư được ví sang registry v3 qua giao diện.
- **Vì sao chưa làm:** đây là admin surface hiếm dùng (di cư contract), và đường an toàn đã
  có trên chain (timelock 7 ngày + veto guardian). Dựng UI cho nó trước khi có v3 là dựng
  cửa cho kẻ tấn công dùng, không phải cho người dùng.
- **Cần để gỡ:** khi thật sự có registry v3 → dựng màn + banner cảnh báo khi có đơn đang chờ.

### B-COV-3 · `get_recovery_registry` không hiện ở màn ví
- **Chặn:** người dùng không tự kiểm được "ví này khôi phục được chưa" từ NGUỒN THẬT (chain).
- **Vì sao quan trọng:** đúng lớp lỗi vừa vá — nếu có ô này từ đầu thì P0 §2 đã lộ ngay.
- **Cần để gỡ:** thêm dòng đọc từ chain vào `/wallet` hub (1 simulateRead).

### B-COV-4 · `batch_add_signer` chưa có đường sản phẩm
- **Chặn:** không nối thêm thiết bị/vỏ (extension quyền hẹp — PHA 9 đường B) vào ví.
- **Vì sao chưa làm:** subsystem chưa dựng, ghi đúng nhãn từ PHA 9.1.

### B-COV-5 · Cooldown sau khôi phục KHÔNG được giải thích ở UI
- **Chặn:** khôi phục xong, ví chối MỌI chữ ký trong cửa sổ cooldown (hành vi ĐÚNG, chống
  xoay-rồi-rút-ngay). Không màn nào đọc `last_rotation` + `cooldown_secs` để nói "còn N giờ".
  Người dùng thấy "ví bị khoá" ngay sau khi vừa cứu được ví — trải nghiệm tệ nhất có thể.
- **Vì sao chưa làm:** BUILD-LOG PHA 6 có ghi TODO này, chưa dựng.
- **Cần để gỡ:** `/recovery/done` + `/wallet` đọc 2 giá trị từ ví, hiện đếm ngược (timelockView
  đã có sẵn từ PHA 7.1).

### B-E2E-MULTI · ĐÃ ĐÓNG ✅ (2026-07-25, phiên audit) — e2e đa thiết bị XANH

- **Nguyên nhân KHÔNG phải locator** (giả thuyết cũ dưới đây sai): mutation đăng ký chết
  thật, mã `WALLET_NOT_CONNECTED`. `page.goto("/setup/review")` là điều hướng CỨNG →
  `SmartAccountKit` dựng mới, `contractId`/`credentialId` (state trong bộ nhớ) rỗng, dù
  IndexedDB vẫn còn phiên. Đây là **lỗi sản phẩm**, không phải lỗi test — người dùng thật
  tạo ví xong tải lại trang cũng không ký được gì. Vá: `ensureWalletConnected()`
  (BUILD-LOG §AUDIT 2026-07-25).
- **Kết quả:** `1 passed (49.1s)` — trước là 10.7 phút vì đứng chờ locator không bao giờ
  hiện. Tx `fe874342…` verify độc lập qua Horizon: `successful: true`, ledger 3785310.
- **Cổng chống hồi quy giờ đã qua đường UI đa thiết bị:** `get_context_rule(0)` ví chủ =
  đúng 1 signer (verifier WebAuthn). Không còn phụ thuộc unit test + đọc ví tay.
- Bằng chứng máy: `docs/evidence/multi-device-latest.json` (spec tự ghi, trước mọi assert).

<details><summary>Ghi chép gốc khi còn đỏ — giữ lại để đối chiếu</summary>

### B-E2E-MULTI · E2e đa thiết bị CHẠY ĐƯỢC nhưng FAIL ở bước cuối (2026-07-25)

- **Đã chứng minh** (spec chạy tới dòng 279 nghĩa là mọi assert trước đó PASS):
  4 BrowserContext, mỗi context một authenticator ảo ĐỘC LẬP · chủ ví deploy ví thật qua
  `/setup` · HAI người thân mỗi người deploy hợp đồng của họ thật qua `/guardian/accept`
  trên "máy" riêng · ba địa chỉ KHÁC NHAU (`new Set(...).size === 3`) · ví chủ đã nối
  registry (`get_recovery_registry` khớp). **Đây chính là claim "mỗi người một máy".**
- **FAIL:** `expect(getByRole("status")).toBeVisible()` sau khi bấm `review-register` —
  locator sai hoặc mutation đăng ký chưa chạy tới nơi. 10.7 phút/lần chạy.
- **CHƯA verify trong lần chạy này** (nằm SAU điểm fail): `get_wallet_config` = 2 guardian +
  threshold 2, và **cổng chống hồi quy `get_context_rule(0)` ví chủ = 1 signer**.
  Cổng đó hiện được chứng minh bằng unit test contract + đọc on-chain ví `CAU26NTA…XCWL`,
  KHÔNG phải qua đường UI nhiều thiết bị.
- **Cần để gỡ:** sửa locator (dùng `getByTestId` cho thông báo đăng-ký-xong thay vì role
  status), chạy lại. Preview :4174 + `RUN_TESTNET_E2E=1 pnpm exec playwright test
  e2e/multi-device --project=chromium`, `LD_LIBRARY_PATH=~/chrome-libs/...`.

</details>

## AUDIT 2026-07-25 — việc còn hở sau phiên audit

### B-AUD-1 · CI vẫn CHƯA ĐỌC ĐƯỢC — không được gọi bất cứ workflow nào là xanh

- **Chặn:** 4 workflow trên `main` vẫn chưa ai xác nhận. B-CI-1 còn nguyên.
- **Đã thử lại trong phiên này, vẫn không được:** `gh` không cài · `GITHUB_TOKEN`/`GH_TOKEN`
  không có trong env · probe API không token trả **404** (repo private).
- **Điều DUY NHẤT được khẳng định:** đã chạy ĐÚNG lệnh + ĐÚNG version CI pin ở local cho
  gitleaks (8.30.1), pnpm (9.15.9 qua corepack), stellar-cli (27.0.0). Đó là tái hiện,
  KHÔNG phải kết quả CI.
- **Việc phải làm ngay khi có người đọc được Actions:** xem lại job `secret-scan` —
  phiên này tìm ra nó **đang đỏ ở `a460465`** và đã vá; cần xác nhận run sau khi push xanh thật.

### B-AUD-2 · Lệch version local ↔ CI còn lại (đã đo, chưa gỡ hết)

| Tool | Local | CI | Đánh giá |
|---|---|---|---|
| pnpm | 11.11.0 | 9.15.9 | **đã chứng minh vô hại** — chạy `corepack pnpm@9.15.9 install --frozen-lockfile` + `pnpm build` honest trên clone sạch đều xanh. Dùng `corepack pnpm` khi muốn giống CI. |
| bun | 1.3.14 | 1.3.11 | lệch patch, local mới hơn; chưa thấy triệu chứng |
| node | 22.23.1 | matrix 20 / 22 / 24 | chỉ tái hiện được nhánh **22**. Nhánh 20 và 24 chưa chạy local (B-CI-3 còn nguyên) |

- **Cần để gỡ:** `nvm install 20 24` rồi chạy lại chuỗi gate từng nhánh; hoặc đọc CI.

### B-AUD-3 · Firefox/webkit cho e2e đa thiết bị — CHƯA chạy, và có lý do

- Spec `multi-device-recovery.spec.ts` tự `test.skip` khi `browserName !== "chromium"`:
  virtual authenticator + testnet thật, chạy ×3 engine là nhân ba bề mặt flake và nhân ba
  số hợp đồng deploy lên testnet. Đây là lựa chọn CÓ CHỦ ĐÍCH, không phải bỏ sót.
- Webkit vẫn fail-env local (thiếu stack GTK4, không sudo) — B-52-1 còn nguyên.

### B-AUD-4 · `be/README.md` mô tả layout ĐÃ CHẾT

- `be/README.md` còn viết frontend ở `../stellar-fe-vite/` và contract ở `../vigiadinh-main/`
  — đó là layout TRƯỚC khi gộp monorepo. Người đọc theo sẽ đi tìm thư mục không tồn tại.
- **Chưa sửa trong phiên này** (ngoài phạm vi audit, và `README.md` gốc mới viết đã dẫn
  đúng đường). Cần một lượt rà lại `be/README.md` + `fe/README.md` cho khớp cây hiện tại.
