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

### CẬP NHẬT closeout 2026-07-25 (đợt 3) — bảng trên ĐÃ LẠC HẬU, đọc bảng này

| Mục | Trạng thái mới | Commit | Test hồi quy (dòng đỏ trên bản cũ) |
|---|---|---|---|
| **B-SEC-3** ví phí | ✅ **ĐÓNG** — thêm hàng rào 1 `is_registered` đọc **từ chain**, và cắm trần phí vào CẢ hai cửa người dùng gọi (đợt 2 chỉ cắm ttl-keeper) | `33e738e` | `send flow > sign của ví CHƯA đăng ký → 403` (bản cũ: intent **settled**, ví phí đã trả) · `submit truyền trần phí xuống gateway` (bản cũ: `[undefined]`) |
| **B-SEC-4** audit_log | ✅ **ĐÓNG ở tầng quyền** — migration 0009 role `app_runtime`. **CÒN (deploy):** `DATABASE_URL` runtime phải trỏ user thuộc `app_runtime` | `39f89ba` | `audit-runtime-role.integration.test.ts` 7 ca, chạy **bằng role runtime** (grant lại quyền → 4 ca đỏ) |
| **B-SEC-9** cooldown `#101` | ✅ **ĐÓNG** — biên nửa mở `[rot, rot+cooldown)`, chốt 4 mốc bằng mã lỗi; **0 mutant sống** trên `__check_auth` | `a4041aa` | `cooldown_boundary_is_exact_at_three_points` (bản cũ `<`→`<=`: test CŨ vẫn xanh, test này đỏ `left: Err(Ok(CooldownActive)) right: Ok(())`) |
| **§3.1** instance TTL của ví | ✅ **KHÔNG CẦN VÁ** — Protocol 23 auto-restore; bằng chứng **hermetic**, chưa đo on-chain | `aee30ec` | `wallet_instance_storage_survives_months_of_disuse` |
| **§3.3** link-is-auth | ✅ **TRẢ DỨT: (a) link-is-auth**, có bước chủ ví ký `add_guardian` chắn. **CÒN:** chưa hiện danh tính người nhận lên màn duyệt | `aee30ec`/BE | `kẻ lạ nhận link của người khác KHÔNG tự lên chain làm người bảo hộ` |
| **§4** thu hồi JWT | ✅ **ĐÓNG phần quyết định** — `jwt_version`. **Đính chính:** JWT ví chưa route nào tiêu thụ → rủi ro TIỀM ẨN | `ed79032` | 3 ca thu hồi (bản cũ: đều xanh vì không kiểm `ver`) |
| **Mutants 3 crate** | ✅ **ĐÓNG cho 3 crate sản phẩm** — origin-verifier 4→0, recovery-registry 11→0, smart-account 3→1(tương đương) | `aee30ec` | `docs/security/mutants.txt` |
| **Kịch bản #3** backend chết | 🔴 **LÀ 🔴, KHÔNG phải caveat** — xem mục mới bên dưới | — | `veto_needs_the_owner_key_while_finalize_needs_nobody` |

### 🔴 MỚI · Veto phụ thuộc backend, finalize thì không (kịch bản #3)

**Chặn:** coi backend là "không ảnh hưởng custody". Sai ở đúng một chiều.

`finalize_recovery` chạy với **zero auth entry** → sau timelock, kẻ tấn công tự nộp tx lên bất kỳ RPC
công cộng, không cần backend mình sống. Veto (`cancel_recovery`) đòi chữ ký ví, mà đường DUY NHẤT để
dựng + nộp tx veto trong sản phẩm là `POST /api/recovery/veto` (build) rồi `POST /api/recovery/submit`
(ví phí nộp). Backend sập ⇒ chủ ví **không veto được**, kẻ tấn công **vẫn finalize được**.

**Vì sao KHÔNG phải lỗi contract:** contract không đòi khoá nào của backend cho veto. Test
`veto_needs_the_owner_key_while_finalize_needs_nobody` khoá cả hai nửa.

**Cần để gỡ:** đường veto tự-chủ phía client — FE dựng invoke `cancel_recovery` + ký passkey + nộp
thẳng RPC (người dùng tự trả phí), không đi qua BE. Kèm hướng dẫn "thẻ cứu hộ" offline.
**Điều kiện mainnet: BẮT BUỘC có.** Timelock dài chỉ có giá trị nếu người phòng thủ nộp được lệnh chặn.

### CÒN MỞ sau closeout đợt 3 — danh sách rút gọn

- **B-CI-1 · CI thật:** vẫn KHÔNG xác minh được. Không `gh`, không `GH_TOKEN` (`be/.mcp.json` chỉ có
  placeholder), API không token → **404** (repo private), SSH xác thực được nhưng GitHub không phục vụ
  Actions API qua SSH. **Cần:** PAT fine-grained (Actions:read + Contents:read).
- **§7 e2e testnet:** CHƯA chạy trên shape mới. Có `FEE_WALLET_SECRET` nhưng **không có deployer key
  riêng**, và `RUN_TESTNET_E2E` chưa bật. Không có byte on-chain nào cho shape hiện tại.
  **Mainnet off the table** tới khi có.
- **§3.2 SEP-45 footprint:** chưa cài check `read_write` theo spec (chỉ `contract_data` +
  `ledger_key_nonce` của Client/Server/Client-Domain; entry `delegated` phải chối).
- **§5.2 fuzz/proptest:** chưa có. Máy build không có nightly → `cargo-fuzz` không dựng; đường
  `proptest` trên stable chưa làm. Nợ 3 target: `__check_auth`, `finalize_recovery`, `recovery_rotate`.
- **verifier-webauthn:** 12 mutant còn sống (crate SPIKE, không nằm trên đường tiền đi). Kèm một
  cặp đáng vá: `.unwrap()` TRẦN ở `lib.rs:104` (`auth_data.get(32).unwrap()` — dữ liệu kẻ tấn công
  điều khiển) chỉ an toàn nhờ cổng `auth_data.len() < 37` ở dòng 97, mà **mutant ở đúng cổng đó
  đang còn sống** (`97:28 < → >`). Cổng sai ⇒ panic TRẦN trên input thù địch. Mức 🟠 vì crate là
  spike (bản tích hợp `origin-verifier` đã chốt cổng này bằng test trong closeout đợt 3), nhưng phải
  vá trước khi spike được dùng ở đường thật. Chi tiết: `docs/security/TOOLS-2026-07-25.md`.
- **Hai scanner vẫn không dùng được** (dòng lỗi chính xác trong `docs/security/TOOLS-2026-07-25.md`):
  `cargo-scout-audit` chết ở **libnghttp2-sys** biên dịch C (`nghttp2/lib/sfparse.c`), không phải
  openssl như đợt trước ghi — cần cài dev package hệ thống (sudo). OZ `soroban-scanner` build được
  từ commit mới `f3888e0` (crate đổi tên thành `soroban-security-detectors-runner`) nhưng **vẫn panic
  UTF-8** ở `sdk/src/ast_types_builder.rs:254` — bug offset của chính tool. Hệ quả: **không có
  detector chuyên Soroban nào chạy**; mutants/clippy/proptest KHÔNG thay thế được lớp đó.
- **B-SEC-4 wiring:** `DATABASE_URL` runtime còn trỏ role owner → quyền đã dựng nhưng CHƯA có hiệu lực.
- **JWT ví chưa có người tiêu thụ:** nối guard phải dùng `verifyWalletJwtCurrent` (facade chỉ export
  bản đó, cố ý).
- **e2e send cần bước register:** cổng ví phí mới đòi `is_registered`, ví e2e sinh mới thì chưa đăng ký.
- **`lefthook.yml` là file ví dụ rỗng** — "pre-commit quét secret / pre-push build thật" mà
  `.claude/rules/` khẳng định **không tồn tại**. gitleaks chỉ chạy CI + tay.
- **Trần cooldown fail-late:** `propose_recovery_registry` nhận cooldown vượt trần, chỉ `apply` mới
  chối (bom không hạ cánh được, nhưng người dùng tự kẹt tới khi `cancel`).
- **Màn duyệt người bảo hộ chưa hiện danh tính người nhận** (`accepted_by_user_id` có ghi, chưa hiện).

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

---

## B-INFRA-1 · `api.familyhaven.mscilabs.com` PHẢI để DNS-only (Cloudflare grey cloud)

Cloudflare Universal SSL (gói free) chỉ phủ `mscilabs.com` + `*.mscilabs.com` — **MỘT** tầng
wildcard. `api.familyhaven.mscilabs.com` là **HAI** tầng → không nằm trong cert đó → bật proxy
(orange cloud) = TLS handshake fail phía edge = `HTTP 000`, không phải lỗi origin.

- Origin khoẻ: cert Let's Encrypt, hết hạn **2026-10-23**, auto-renew đang chạy.
- **Muốn có WAF** thì phải một trong hai: đổi sang `familyhaven-api.mscilabs.com` (1 tầng,
  lọt wildcard free), hoặc mua Cloudflare ACM (Advanced Certificate Manager).
- **Hệ quả đang chấp nhận:** không có WAF trước API, và IP origin `14.225.198.86` lộ ra DNS
  công khai → phải dựa hoàn toàn vào firewall + rate limit ở tầng app.

## B-ENV-1 · R2 từng là PROD-REQUIRED nhưng KHÔNG DÙNG — ĐÃ ĐÓNG 2026-07-26

Quyết định sản phẩm: **không upload ảnh**. Nhận diện người bảo hộ bằng **nhãn text + địa chỉ ví**.

- Trạng thái cũ: `src/env.schema.ts` xếp `R2_*` cùng mức bắt buộc như `DATABASE_URL`
  (`z.string().min(1)`), `src/lib/storage.ts` export `r2` nhưng **0 consumer production** →
  VPS phải chạy giá trị bịa `dummy_chua_dung_r2` để boot qua GATE env:check.
- **Đã sửa:** xoá `src/lib/storage.ts`, gỡ `R2_*` khỏi `env.schema.ts`, khỏi
  `deploy/env.production.example` + `.env.example`, khỏi fixture test và `init-project.mjs`.
- **Việc TAY còn lại trên VPS:** xoá 4 dòng `R2_*` khỏi `deploy/.env.production` rồi `up -d`
  (không cần `--build` — chỉ env đổi). Để lại cũng không sập (biến thừa bị bỏ qua), nhưng
  `check:env-parity` sẽ kêu key ACTIVE không có trong schema.

## B-FE-1 · ~~vitest FE KHÔNG CHẠY ĐƯỢC~~ — **ĐÓNG 2026-07-27, đo thật trong WSL**

> **KHÔNG CÒN ĐÚNG.** Toàn bộ chuỗi build chạy XANH trong WSL, Node 20.20.2 (nvm) + pnpm 9.15.9:
> `install --frozen-lockfile` ✅ · `csp-script-hash` ✅ · `validate` ✅ · `test` ✅ ·
> `audit --audit-level=high` ✅ · `build` (honest) ✅ — cả 6 bước `exit=0`.
> `node_modules/.pnpm/` HIỆN chứa `@esbuild+linux-x64@0.28.1`, tức cây deps đã được cài lại
> từ Linux ở phiên nào đó sau khi mục này được viết. Chẩn đoán "binary win32" bên dưới đúng
> tại thời điểm viết, SAI ở hiện tại — đừng dùng nó để tự miễn chạy test nữa.
> Cái còn đúng: `/mnt/d` CHẬM (KI-5) — `tsc --noEmit` mất ~13 phút, build ~8 phút. Chậm ≠ hỏng.
> Cách chạy: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` rồi chạy như bình thường.

### Nội dung gốc (giữ làm lịch sử — đã hết hiệu lực)

`npx vitest run <bất kỳ file nào>` chết ngay khi nạp runner:
```
Cannot find module '@rolldown/binding-linux-x64-gnu'
Cannot find module '../rolldown-binding.linux-x64-gnu.node'
```
**NGUYÊN NHÂN GỐC (đã xác định chính xác, không phải phỏng đoán):** `node_modules/.pnpm/`
chứa `@biomejs+cli-win32-x64@2.5.0` — **binary WINDOWS**. Cây deps FE được cài **từ Windows**,
nên MỌI optional dependency theo nền tảng đều resolve về `win32-x64` và không có bản
`linux-x64` nào. Vì vậy chạy tooling FE trong WSL (Linux) là không thể với `node_modules` này:
biome, rolldown/vitest, và mọi thứ có native binary đều đứt cùng một lý do.
```
node_modules/.pnpm/@biomejs+cli-win32-x64@2.5.0    ← có (Windows)
node_modules/.pnpm/@biomejs+cli-linux-x64@2.5.0    ← KHÔNG có
node_modules/.pnpm/@rolldown+binding-linux-x64-gnu ← KHÔNG có
```

**Hai đường sửa, người quyết định:**
1. Chạy tooling FE **từ Windows** (PowerShell/cmd trong `D:\du-an\thi-stella\family-wallet\fe`)
   — không đụng gì, dùng đúng binary đã cài.
2. Cài lại trong WSL: `pnpm install` (nó sẽ đòi xoá trắng `node_modules`). Sau đó tooling
   chạy được trong WSL nhưng **hỏng phía Windows** — không dùng chung một cây `node_modules`
   cho cả hai nền tảng được.

- **Không phải regress phiên này**: test có sẵn (`src/lib/i18n-icu.test.ts`) đỏ y hệt,
  không liên quan gì tới thay đổi trong phiên.
- **`pnpm install --frozen-lockfile` đòi XOÁ TRẮNG toàn bộ node_modules rồi cài lại**
  ("The modules directories will be removed and reinstalled from scratch"). CHƯA CHẠY:
  thao tác phá huỷ, rất chậm trên `/mnt/d` (WSL), và có phiên khác dùng chung cây làm việc.
  Cần người quyết định.
- **Hệ quả:** mọi test FE phiên này ở mức `[CHƯA CHẠY ĐƯỢC]`, KHÔNG phải `[CHẠY THẬT]`.
  `tsc --noEmit` FE vẫn xanh (không cần rolldown).

## B-FE-2 · `public/.well-known/stellar.toml` — ĐÃ TẠO 2026-07-26 (đóng phần thiếu file)

`fe/apps/web/public/.well-known/` chỉ có `apple-app-site-association` + `assetlinks.json`.
SEP-45 đòi `stellar.toml` ở home domain, chứa `WEB_AUTH_FOR_CONTRACTS_ENDPOINT` +
`WEB_AUTH_CONTRACT_ID`. Thiếu → client không tìm được endpoint → **không ai đăng nhập được**.

Giá trị đã có sẵn để điền (BE `.env`):
`SEP45_WEB_AUTH_CONTRACT_ID=CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST` (testnet).

**Chưa làm trong phiên này** — hết ngân sách context, và cần chốt luôn home domain
production (`familyhaven.mscilabs.com`) + endpoint (`https://api.familyhaven.mscilabs.com/api/sep45`)
trước khi ghi file, để không đẻ ra một file sai phải sửa lại sau.

**Đã tạo** `fe/apps/web/public/.well-known/stellar.toml` với giá trị testnet THẬT:
`WEB_AUTH_CONTRACT_ID=CAKV3MKK…SST` (khớp BE env) + `SIGNING_KEY=GB3672…QBP` (khoá CÔNG KHAI
dẫn xuất từ `SEP45_SIGNING_KEY`; khoá bí mật KHÔNG rời env). Lên mainnet phải đổi passphrase +
deploy lại contract + đổi id. TOML đã verify parse được.

## B-SEP45-1 · BE tách GET/POST ra HAI path → không đúng spec SEP-45

Spec (giống SEP-10): `WEB_AUTH_FOR_CONTRACTS_ENDPOINT` là **MỘT** URL mà `GET` trả challenge và
`POST` đổi lấy JWT. Backend hiện tại tách đôi:

- `GET  /api/sep45/challenge` (`be/src/modules/sep45/routes.ts:53`)
- `POST /api/sep45/token`     (`be/src/modules/sep45/routes.ts:70`)

Không có route nào ở `/api/sep45` gốc.

- **Luồng trong app VẪN CHẠY** — FE gọi thẳng hai đường đó
  (`fe/apps/web/src/features/wallet/api/sep45-login.ts:41,63`), không đọc `stellar.toml`.
- **Client SEP-45 bên thứ ba sẽ HỎNG**: đọc toml → `GET /api/sep45` → 404.
- `stellar.toml` đang ghi giá trị **đúng theo spec** (`/api/sep45`) — nó thành đúng ngay khi BE
  gộp hai verb về một path. Cách sửa rẻ nhất: mount thêm `GET /` và `POST /` trong `sep45Routes`
  trỏ vào chính hai handler sẵn có, giữ path cũ làm alias để không phá FE.
- **Chưa sửa**: nằm ngoài phạm vi việc deploy FE, và đụng vào cổng login thì phải có test riêng.

## B-EXT-1 · Extension CHƯA CHẠY ĐƯỢC — 3 lỗi chặn, chưa từng load-unpacked (2026-07-27)

Kết luận dứt khoát: **CHƯA DÙNG ĐƯỢC, và chưa ai thử load lần nào.** Không phải "chưa test" —
có bằng chứng nó *không thể* load ở trạng thái hiện tại. Manifest V3 ✅, tên/mô tả KHÔNG phải rác
template (`_locales` en/vi/zh_CN đầy đủ, "FamilyWallet"/"VíGiaĐình"/"家庭钱包"). Ba lỗi chặn:

1. **Thiếu toàn bộ thư mục `icons/`.** `manifest.json` khai `icons` 16/48/128 + `action.default_title`,
   nhưng `extension/` chỉ có `manifest.json` `popup.html` `popup.js` `service-worker.js` `_locales/`
   `README.md`. Chrome từ chối load unpacked khi file icon khai báo không tồn tại ⇒ **chứng minh
   extension chưa từng được load thành công**, nếu không lỗi này đã lộ ngay lần đầu.
2. **Domain là placeholder, không phải BE thật.** `host_permissions: ["https://app.familywallet.example/*"]`
   và `API_BASE = "https://app.familywallet.example"` ở CẢ `service-worker.js:10` LẪN `popup.js:4`
   (popup còn mở `${API_BASE}/guardian` và `/login`). Domain đó không tồn tại. Phải là
   `https://api.familyhaven.mscilabs.com` cho API và `https://familyhaven.mscilabs.com` cho tab —
   **hai origin khác nhau**, hiện đang bị gộp làm một.
3. ~~**Tên lệch web app**: extension tên "FamilyWallet", web đã chốt "FamilyHaven".~~
   **ĐÃ SỬA 2026-07-27** — xem §1.3 dưới đây. Còn lại lỗi 1 và 2, cả hai vẫn CHẶN load.

### §1.3 · Tên sản phẩm — chốt "FamilyHaven", một nguồn duy nhất

Đo được: **bốn tên cho một sản phẩm**. Web `FamilyHaven`; extension
`FamilyWallet`/`VíGiaĐình`/`家庭钱包` (mỗi locale một tên); Capacitor `appName: FamilyWallet`.
Không test nào bắt được vì mỗi chỗ tự khai một hằng số riêng.

Vì sao đây không phải chuyện thẩm mỹ: `rpName` (`features/wallet/lib/kit.ts`) lấy thẳng
`VITE_APP_NAME`, và **đó là dòng chữ trong hộp thoại vân tay/Face ID lúc người dùng KÝ giao dịch
tiền**. Tên ở đó khác tên trên tab, khác tên dưới icon màn hình chính, khác tên extension đang xin
duyệt — người dùng có đủ lý do để nghi ngờ đúng vào giây họ quyết định ký.

Đã chốt **FamilyHaven**, khớp luôn `rpId = familyhaven.mscilabs.com`. Tên thương hiệu **KHÔNG
dịch**: web hiện `site.name` y hệt ở cả ba ngôn ngữ (nó là biến env, không phải khoá i18n), nên
extension theo đúng vậy; phần copy còn lại vẫn dịch bình thường. Test
`apps/web/src/test/brand-name.test.ts` khoá lại theo NGUYÊN TẮC — mọi chỗ hiển thị phải quy về
`VITE_APP_NAME`, chỗ nào chạy ngoài Vite (extension, Capacitor) phải khai đúng giá trị đó.

**Cố ý KHÔNG đổi `appId: app.familywallet`** (`capacitor.config.json`, và `package_name` tương ứng
trong `assetlinks.json` + `apple-app-site-association`). Nó là ĐỊNH DANH reverse-DNS, không phải
tên hiển thị; đổi sau khi đã lên store là gãy đường cập nhật của mọi máy đã cài — cùng loại quyết
định một chiều như `rpId`. Đáng bàn riêng khi thật sự nộp store, không đổi kèm việc sửa tên hiển
thị. (Ghi luôn cho lần đó: `app.familywallet` không phải reverse-DNS của domain ta sở hữu.)

### Passkey: extension KHÔNG dùng chung được với web (chưa cấu hình)

Origin của extension là `chrome-extension://aakakeieeijeflbnblolnlhmooibddmc` — **không phải
subdomain** của `familyhaven.mscilabs.com`, nên `rpId = familyhaven.mscilabs.com` không phủ tới nó.
Cơ chế duy nhất nối hai origin là **Related Origin Requests**: home domain phải phục vụ
`/.well-known/webauthn` trả JSON `{"origins":[...]}`.

Đo thật 2026-07-27: `curl https://familyhaven.mscilabs.com/.well-known/webauthn` → **HTTP 200 nhưng
trả về `index.html`**. Đây TỆ HƠN 404: SPA fallback `/*  /index.html  200` nuốt mọi đường dẫn chưa
có file, nên trình duyệt nhận HTML ở chỗ nó chờ JSON. ⇒ Related Origin Requests **chưa cấu hình**,
passkey tạo trên web **không dùng được** trong extension và ngược lại.

Muốn nối: thêm `fe/apps/web/public/.well-known/webauthn` (JSON, có `chrome-extension://<id>` trong
`origins`) — cùng chỗ với `stellar.toml`, và nhớ luật `_headers` cho content-type.

#### CẬP NHẬT 2026-07-27 (phiên đóng nốt FE) — phía WEB đã làm xong

`fe/apps/web/public/.well-known/webauthn` đã có, `_headers` ép `application/json`, `_redirects`
có luật `.well-known` đứng trước catch-all. Test `apps/web/src/test/well-known.test.ts` + gate
`.well-known content-type` trong `deploy-fe.yml` khoá lại. Phía extension vẫn còn lỗi 1 và 2.

**Sửa một tuyên bố SAI trong bản ghi trước:** id `aakakeieeijeflbnblolnlhmooibddmc` **KHÔNG PHẢI**
id tạm của bản unpacked, và nó **KHÔNG đổi khi đóng gói**. `extension/manifest.json` có trường
`key` (khoá công khai RSA), nên Chrome DẪN XUẤT id từ đúng khoá đó thay vì từ đường dẫn thư mục —
id được GHIM. Kiểm lại bất cứ lúc nào bằng chính phép tính Chrome dùng (16 byte đầu của SHA-256
khoá DER, mỗi nibble → `'a' + n`):

```bash
node -e 'const f=require("fs"),c=require("crypto");
const k=JSON.parse(f.readFileSync("extension/manifest.json","utf8")).key;
const h=c.createHash("sha256").update(Buffer.from(k,"base64")).digest();
let id="";for(let i=0;i<16;i++){id+=String.fromCharCode(97+(h[i]>>4))+String.fromCharCode(97+(h[i]&15));}
console.log(id);'
# → aakakeieeijeflbnblolnlhmooibddmc
```

Test `well-known.test.ts` TÍNH LẠI id này từ manifest mỗi lần chạy chứ không so với hằng số chép
tay — đổi `key` mà quên sửa `.well-known/webauthn` là test đỏ ngay.

⚠️ **Điều kiện id đổi (vẫn phải canh):** nếu Chrome Web Store cấp khoá khác lúc publish (xảy ra khi
gói tải lên KHÔNG mang `key` này, hoặc item được tạo mới), id sẽ khác và `origins` phải cập nhật —
nếu không, Related Origin Requests chết trên bản store trong khi bản unpacked vẫn chạy. Giữ `key`
trong manifest khi đóng gói là cách rẻ nhất để id không đổi.

⚠️ **Ý nghĩa an toàn:** mỗi origin trong `.well-known/webauthn` là một origin được phép dùng passkey
**điều khiển tiền** của ví. Hiện file mở quyền cho một extension CHƯA từng load được (lỗi 1+2) —
vô hại lúc này vì chỉ khoá riêng của ta mới sinh ra được id đó, nhưng đừng thêm origin cho tiện.

**Lỗi 1 và 2 KHÔNG sửa trong phiên này** — extension là deliverable riêng, sửa nó cần load thử trên
Chrome thật mới gọi là xong (§1.3 chỉ chốt TÊN, xem bên dưới).

## B-CF-2 · CI deploy CHƯA NỐI — deploy FE hiện là TAY (2026-07-27)

Bản production đang chạy được đẩy lên bằng `wrangler pages deploy` chạy tay, **không** qua
`deploy-fe.yml`. Workflow vẫn **chưa từng chạy một lần nào trên runner thật** (nhánh `feat/mainnet`
chưa push — xem B-CI-1). Để nối:

1. Cloudflare API Token quyền **Account → Cloudflare Pages → Edit** (OAuth của máy local KHÔNG
   dùng được cho CI).
2. GitHub → Settings → Secrets and variables → Actions → Secrets:
   - `CLOUDFLARE_API_TOKEN` = token ở bước 1
   - `CLOUDFLARE_ACCOUNT_ID` = `b79e6e346d19031bf1b709d7a7dce34c`
3. Cần PAT fine-grained để push + set secret + đọc log (B-CI-1 vẫn mở).

⚠️ Ngay cả khi nối xong, job `build-and-gate` sẽ **ĐỎ ở gate D1** cho tới khi 4 biến chain mainnet
được điền (contracts chưa deploy — xem B-CF-3). Đó là **đúng thiết kế**, không phải hỏng CI.

### Bẫy môi trường đã trả giá: `wrangler` KHÔNG upload được từ WSL

`pages deploy` từ WSL2 chết ở `ETIMEDOUT` giữa chừng (dừng ~55/164 file), retry cũng thế —
trong khi `pages project list` (GET) và `curl` tới `api.cloudflare.com` vẫn OK, và MTU 1500 đã
loại trừ (ping DF payload 1472 qua được). Tức là hỏng riêng ở đường upload bulk của WSL2 NAT.
**Cách chạy được:** gọi từ Windows —
`powershell.exe -NoProfile -Command "cd 'D:\du-an\thi-stella\family-wallet\fe'; npx wrangler@4 pages deploy ..."`.
Credential OAuth nằm ở `C:\Users\huyng\AppData\Roaming\xdg.config\.wrangler\config\default.toml`;
từ WSL đọc được bằng `XDG_CONFIG_HOME=/mnt/c/Users/huyng/AppData/Roaming/xdg.config` (đủ cho lệnh
GET, KHÔNG đủ cho upload). Trên CI không dính bẫy này — runner Linux thật, không qua WSL.

Ghi chú: `pages project create` cũng trả `8000000 unknown error` hai lần rồi thành công ở lần thứ
ba với body y hệt — lỗi thoáng qua phía Cloudflare, cứ retry, đừng đổi tên project.

## B-CF-3 · LỆCH MẠNG BA TẦNG — UI xem được, KHÔNG luồng thật nào chạy

Ba tầng đang ở ba mạng khác nhau. Đây là thứ chặn người thật dùng ví, không phải lỗi FE:

| Tầng | Trạng thái | Đo lúc 2026-07-27 |
|---|---|---|
| FE (bản vừa deploy) | **mainnet** | passphrase `Public Global…`, RPC trỏ `…/rpc` |
| BE (VPS đang chạy) | **testnet**, bản CŨ | `GET /health` → `{"ok":true}` nhưng `POST /rpc` → **404** (proxy nằm trong 22 commit chưa push) |
| Contracts mainnet | **chưa deploy** | không có bản ghi deploy nào trong `contracts/` |

Hệ quả cụ thể:
- `VITE_ACCOUNT_WASM_HASH` / `VITE_WEBAUTHN_VERIFIER_ADDRESS` / `VITE_RECOVERY_REGISTRY_ADDRESS`
  build ra **RỖNG** (Zod cho optional) → màn tạo ví tự chặn, không đẻ ra ví cụt.
  Chỉ `VITE_SAC_NATIVE` có giá trị thật (`CAS3J7…OWMA`, hằng số mainnet, H1 nói điền được ngay).
- `dist/.well-known/stellar.toml` ship kèm **template `__WEB_AUTH_CONTRACT_ID__` chưa thay** —
  gate D5 ĐỎ đúng như thiết kế. Chấp nhận có chủ ý cho lần deploy này (quyết định của user):
  luồng trong app KHÔNG đọc file này (FE gọi thẳng hai path BE), chỉ client SEP-45 bên thứ ba đọc —
  mà nhóm đó vốn đã hỏng sẵn vì B-SEP45-1. **Không được coi là đã xong.**
- `SIGNING_KEY` trong stellar.toml vẫn là G của khoá **testnet** dev (B-MAINNET-4).

**Chốt trước khi cho ai thử ví thật.** Thứ tự sửa: MAINNET-CHECKLIST.md mục H3.

### Badge "Mạng chính" đang NÓI TRƯỚC SỰ THẬT — quyết định 2026-07-27: GIỮ mainnet

`components/family/product-shell.tsx:14` — `isTestnet = env.VITE_STELLAR_NETWORK_PASSPHRASE.startsWith("Test ")`,
rồi header hiện `network.mainnet` = **"Mạng chính"** (en "Mainnet", zh "主网"). Đây là **hằng số lúc
build**, nó chỉ nói *FE được cấu hình cho mạng nào*, KHÔNG nói chuỗi phía sau có sống không.
Người dùng ví đọc badge đó là "ví này đang chạy trên mạng thật" — trong khi BE còn testnet và
contract mainnet chưa tồn tại. Với UI của một cái ví tiền, hiển thị sai mạng nguy hiểm hơn lỗi UI
thường.

Hai lựa chọn đã cân, **chọn (B)**:
- (A) Hạ FE về testnet cho khớp BE — bác bỏ: phải đảo ngược toàn bộ migration đã commit
  (`a9b23db`→`d825aac`), CSP/`connect-src` và `stellar.toml` đều đang hình mainnet, và BE sẽ lên
  mainnet chứ không ở lại testnet. Đảo chiều rồi đảo lại là tự chuốc hai lần rủi ro.
- (B) **GIỮ mainnet**, ghi nợ tại đây: badge ĐÚNG so với cấu hình FE, SAI so với hệ thống. Nó chỉ
  trở thành đúng khi B-CF-3 đóng (BE mainnet + contracts deploy).
  Nếu cần cho người ngoài dùng thử TRƯỚC khi B-CF-3 đóng thì phải sửa badge trước — cách rẻ nhất là
  cho nó phản ánh **khả năng gọi được chuỗi** (ping `/rpc`) chứ không phải hằng số passphrase.

## B-FE-5 · TRANG MẪU TEMPLATE ĐÃ LÊN PRODUCTION ở `/` — vá 2026-07-27

`https://familyhaven.mscilabs.com/` phục vụ nguyên **trang giới thiệu template**: tiêu đề + 6 thẻ
khoe stack ("TanStack Router", "TanStack Query v5", "Better Auth", "SSE", "Tailwind v4 + shadcn",
"RHF + Zod"), bản tiếng Việt ghi *"FE mẫu React 19 + Vite — cắm thẳng BE Bun + Hono + Better Auth."*
Đây là thứ ĐẦU TIÊN người vào gốc domain nhìn thấy; `/welcome` mới là màn mở đầu thật.

**Vì sao lọt qua mọi vòng kiểm** — đây mới là bài học, không phải cái lỗi:
chuỗi hiển thị nằm trong `apps/web/src/locales/*/common.json` (khối `home.*`), KHÔNG nằm trong TSX.
`index.tsx` chỉ có `t("home.description")` và `t(\`home.stack.${key}.title\`)` — **không một ký tự
tiếng Việt nào**. Nên: grep theo tên biến → trượt; grep `"Mau Demo"` → trượt (chuỗi là "FE mẫu");
gate dist theo `%VITE_*%`/`<title>` → trượt (title vẫn đúng "FamilyHaven"). Guard
`scripts/check-user-copy.mjs` VỐN ĐÃ quét đúng file locale, chỉ là danh sách TOKENS không có cụm nào
khớp. **Bắt theo chuỗi NGƯỜI DÙNG NHÌN THẤY, và bắt cả tiếng Việt.**

Đã vá: `/` chuyển hướng `/welcome` bằng `redirect()` trong `beforeLoad` (không `<Navigate>` — tránh
nháy một frame); xoá khối `home.*` khỏi cả 3 locale (parity 25 key giữ nguyên); `check-user-copy.mjs`
thêm 7 token (`FE mẫu`, `cắm thẳng`, `TanStack`, `shadcn`, `tailwind`, `better auth`, `RHF`);
`deploy-fe.yml` thêm gate dist theo 7 chuỗi ĐÃ ĐO.

Guard mở rộng bắt được **3 lỗi cùng loại chưa ai thấy**: `admin.json` cả 3 locale ghi *"User metrics
from the Better Auth admin API"* và *"…server-side via listUsers"* — tên thư viện + tên hàm nội bộ
trong copy hiển thị cho admin. Đã viết lại thành tiếng người.

⚠️ Gate dist cố ý HẸP. KHÔNG thêm `TanStack` trần: nó khớp comment trong chính `public/_redirects`
("để TanStack Router tự route phía client") và khớp 67 file khác (tên chunk `vendor-tanstack-*.js`,
manifest precache `sw.js`). Gate luôn-đỏ là gate sẽ bị tắt.

## B-FE-6 · `font-src 'self'` CHẶN font mono trên production — vá 2026-07-27

Quét production bằng chromium thật (23 màn): **mọi màn** log
`Loading the font 'data:font/woff2;base64,d09GMgAB…' violates the following Content Security Policy`.
Nguồn: `@font-face` của **JetBrains Mono Variable** trong `dist/assets/index-*.css` dùng
`src:url(data:font/woff2;base64,…)` — Vite nhúng thẳng vì file nhỏ hơn `assetsInlineLimit`
(ba font Fraunces to hơn nên vẫn là `/assets/fraunces-*`, không dính). Hậu quả: font mono bị chặn,
rơi về font hệ thống, **im lặng** — không ai thấy trừ khi mở Console.

Vá: `font-src 'self' data:` trong `public/_headers` **và** `deploy/nginx.conf` (hai file phải đồng bộ).
Rủi ro thấp: font không thực thi được như script, và policy này vốn đã cho `data:` ở `img-src`.
Siết lại được nếu muốn — hạ `assetsInlineLimit` để font không bao giờ inline, nhưng đó là đổi build,
phải đo lại dist.

## B-FE-7 · Cloudflare Web Analytics beacon bị CSP chặn — CẦN QUYẾT (chưa sửa)

Cùng đợt quét: mọi màn cũng log
`Loading the script 'https://static.cloudflareinsights.com/beacon.min.js/…' violates … CSP`
+ một `requestfailed … csp`. **Không phải script của ta** — Cloudflare Pages TỰ TIÊM khi bật Web
Analytics. CSP `script-src 'self' 'sha256-…'` chặn nó, nên: console bẩn trên mọi trang, và
**analytics không chạy** dù dashboard báo đã bật.

Hai đường, người quyết:
1. **Tắt auto-injection** ở Cloudflare (Web Analytics → tắt automatic setup cho site này). Khuyến
   nghị — giữ `script-src` nguyên vẹn.
2. Thêm `https://static.cloudflareinsights.com` vào `script-src` + `connect-src`. **Không tự làm**:
   nới `script-src` cho một script bên thứ ba đi ngược đúng thứ CSP này sinh ra để chặn, và
   `.gitleaks`/security rule của repo coi `script-src` là hàng rào chính chống XSS.

## B-FE-9 · `sw.js` bị cache 4 GIỜ trên custom domain (KHÔNG phải trên pages.dev)

`public/_headers` đặt `/sw.js → max-age=0, must-revalidate` và Cloudflare TÔN TRỌNG điều đó trên
`*.pages.dev`. Nhưng trên **custom domain** thì không. Đo song song 2026-07-27:

| đường dẫn | `familyhaven.pages.dev` | `familyhaven.mscilabs.com` |
|---|---|---|
| `/` | `max-age=0, must-revalidate` ✅ | `max-age=0, must-revalidate` ✅ |
| `/assets/*.css` | `max-age=31536000, immutable` ✅ | `max-age=31536000, immutable` ✅ |
| **`/sw.js`** | `max-age=0, must-revalidate` ✅ | **`max-age=14400, must-revalidate`** ❌ |

14400s = 4 giờ = **đúng mặc định "Browser Cache TTL" của zone Cloudflare**. Zone áp nó cho tài
nguyên tĩnh cacheable (`.js`), trong khi HTML được miễn và luật `immutable` của `/assets/*` sống sót
— nên chỉ mỗi `sw.js` dính, và chỉ trên domain có proxy zone.

Hậu quả: trình duyệt có thể phục vụ `sw.js` từ cache tới 4 giờ ⇒ update-toast (D-052) chậm tối đa
4 giờ. KHÔNG phải "kẹt vĩnh viễn" (không có `immutable`, vẫn `must-revalidate`), nhưng đúng thứ luật
`_headers` sinh ra để chống.

**Cần làm trên dashboard (người dùng):** zone `mscilabs.com` → Caching → Configuration →
**Browser Cache TTL = "Respect Existing Headers"**. Hoặc hẹp hơn: Cache Rule riêng cho `/sw.js`.
Không sửa được từ `_headers` — zone override đứng trên nó.

⚠️ Bài học đo lường: đây là lỗi **chỉ lộ trên custom domain**. Kiểm trên `*.pages.dev` rồi kết luận
"header đúng" là sai — hai đường đi qua cấu hình khác nhau.

## B-FE-8 · SPA fallback nuốt mọi file thiếu → không có 404 thật — VÁ MỘT PHẦN 2026-07-27

> **Trạng thái:** `.well-known/` ĐÃ đóng (luật `/.well-known/*  /404.html  404` đứng trước
> catch-all + `public/404.html`). Phần **còn mở**: mọi đường KHÁC vẫn trả 200 + HTML —
> `/nothing-here.png` vẫn là 200. Cố ý thu hẹp phạm vi: `.well-known/` là chỗ có client máy
> đọc (trình duyệt, iOS, ví SEP-45) nên hỏng im lặng; ảnh/asset thiếu thì người nhìn thấy ngay.
> Muốn đóng nốt phải liệt kê từng tiền tố tĩnh (`/assets/*`, `/*.png`…) — làm mù dễ chặn nhầm
> route ứng dụng, nên để lại làm việc có chủ đích.



`public/_redirects` là catch-all `/*  /index.html  200`. Hệ quả đo được: `/nothing-here.png` trả
**200 + HTML**, và `/.well-known/webauthn` cũng trả **200 + HTML** thay vì 404 (xem B-EXT-1 — đây là
lý do Related Origin Requests hỏng im lặng). Với route ứng dụng thì đúng (router client tự xử, và
`notFoundComponent` hiện "404 — Page not found" đàng hoàng). Với **file tĩnh và `.well-known/`** thì
sai: client nào chờ JSON/ảnh sẽ nhận HTML.

Cách sửa khi cần: thêm luật cụ thể TRƯỚC dòng catch-all (Pages khớp từ trên xuống), ví dụ
`/.well-known/*  /404  404`, rồi khai báo riêng file `.well-known` nào có thật.
**Chưa sửa** — nằm ngoài phạm vi phiên này, nhưng phải xử trước khi làm extension (B-EXT-1).

## B-FE-10 · PWA đã CÀI ĐƯỢC (2026-07-27) — còn hở đúng một gate: iOS máy thật

**Quyết định (người giao việc chốt 2026-07-27): CÓ hỗ trợ "cài lên màn hình chính".** Trước đó
`VitePWA({ manifest: false })` — service worker VẪN chạy và precache, nên mọi dấu hiệu bề ngoài
giống một PWA đầy đủ, nhưng không có manifest thì trình duyệt không bao giờ mời cài. Đã thêm:
manifest thật (`name` lấy từ `VITE_APP_NAME`, cùng nguồn với `<title>` và `rpName`), 4 icon sinh
từ linh vật (`scripts/make-app-icons.mjs`), 3 thẻ iOS trong `index.html`.

Hai thứ đo được lúc làm, đáng ghi vì cả hai đều "xanh mà sai":

1. **Khối `@media (display-mode: standalone)` trong `family.css` là NO-OP hai lần** — đã gỡ.
   Không manifest nên chưa bao giờ chạy; và kể cả chạy thì hai khai báo trong đó GIỐNG HỆT luật
   nền (`.product-shell__chrome` padding-top, `.product-screen` padding-bottom — cùng `max()`,
   cùng `env()`). E2e cũ assert `hasStandaloneRule` (CSS có chứa CHUỖI đó không) nên xanh suốt
   trong khi không đo gì cả. Test mới bật `display-mode: standalone` bằng CDP rồi mới đo.
2. **`includeManifestIcons` của vite-plugin-pwa mặc định `true` và BỎ QUA `globPatterns`** — đo
   thật trên dist: 3 icon PNG (231 KiB) vào precache dù `globPatterns` không có `png`. Đã tắt.
   Precache 126 → 123 entry.

### CÒN HỞ — iOS standalone máy thật

`docs/UI-PLATFORM-REPORT.md` mục QA #1 vẫn **CHƯA CHẠY**: host Windows/WSL không có iPhone.
E2e mới chạy chromium EMULATE `display-mode: standalone` + `Emulation.setSafeAreaInsetsOverride`
(safe-area top 47 / bottom 34, nút submit nằm trọn trong màn) — đủ để bắt lỗi CSS, **không** thay
được máy thật. Hai thứ chỉ iPhone thật mới nói được:

- Icon + tên dưới icon trên màn hình chính iOS (`apple-touch-icon`, `apple-mobile-web-app-capable`
  chỉ được kiểm là CÓ MẶT và trỏ đúng file, chưa ai thấy nó hiện ra).
- **Storage partition:** PWA cài trên iOS có kho lưu trữ RIÊNG với Safari. Passkey nằm ở keychain
  nên vẫn dùng chung được, nhưng **phiên đăng nhập thì không**. Người tạo ví trong Safari rồi cài
  lên màn hình chính sẽ mở ra một app trông như chưa có gì. Chưa đo được từ đây, và đây là thứ
  đáng sợ nhất trong mục này vì nó giống hệt "mất ví" dưới mắt người dùng.

Cần: một iPhone thật, cài từ Safari, kiểm 2 gạch đầu dòng trên. Không có thì đừng ghi PWA là xong.

## B-CF-1 · Deploy FE cần 4 bước dashboard — CHƯA LÀM ĐƯỢC TỪ ĐÂY

`.github/workflows/deploy-fe.yml` đã sẵn sàng nhưng **SKIP bước deploy** cho tới khi có secrets.
Bốn việc phải làm bằng tay trên Cloudflare/GitHub (không có credential trong môi trường này):

1. Cloudflare → Workers & Pages → Create → Pages → **Direct Upload**, tên project `familyhaven`.
2. Account API Token quyền **Cloudflare Pages — Edit**.
3. GitHub → Settings → Secrets and variables → Actions:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (+ var `CF_PAGES_PROJECT_WEB` nếu tên khác).
4. Sau deploy đầu tiên: project → Custom domains → `familyhaven.mscilabs.com`.

⚠️ **KHÔNG test auth trên `*.pages.dev`**: `pages.dev` nằm trong Public Suffix List → khác site với
`api.familyhaven.mscilabs.com` → cookie session không set, và sẽ tưởng code sai. Chỉ test trên
custom domain.

## B-FE-3 · `fe/.github/workflows/` CHƯA BAO GIỜ CHẠY — còn `ci.yml` mồ côi

GitHub chỉ đọc `.github/workflows/` ở **gốc repo**. Từ khi FE thành thư mục con của monorepo, mọi
workflow trong `fe/.github/workflows/` là **code chết**. Root `ci-fe.yml` tự ghi trong header:
*"Port từ fe/.github/workflows/ci.yml (GitHub chỉ đọc workflow ở root monorepo)"* — tức là `ci.yml`
đã được port nhưng **bản gốc không ai xoá**.

- `fe/.github/workflows/deploy.yml` — **ĐÃ XOÁ 2026-07-26**, thay bằng `.github/workflows/deploy-fe.yml`
  ở root. Bản cũ chưa từng chạy một lần nào, nên "deploy đã có sẵn" trong các ghi chú trước là SAI.
- `fe/.github/workflows/ci.yml` — **ĐÃ XOÁ 2026-07-27**. Đã diff trước khi xoá: `ci-fe.yml` là
  SIÊU TẬP thực sự (thêm path filter, `working-directory: fe`, `package_json_file`,
  `cache-dependency-path`, bước `check:contract` gốc) — không mất gì. `fe/.github/` giờ trống sạch.
- ⚠️ `be/.github/workflows/ci.yml` — **CÙNG BỆNH, CÒN NGUYÊN**. Ngoài phạm vi phiên FE-deploy này
  nên KHÔNG đụng. Ai làm BE: hoặc port lên root thành `ci-be.yml` (root đã có `ci-be.yml` — kiểm
  trùng trước), hoặc xoá.

## B-FE-4 · Hai lỗi trong `deploy-fe.yml` khiến lần chạy CI ĐẦU TIÊN sẽ chết — ĐÃ SỬA 2026-07-27

Workflow chưa từng chạy trên runner thật (nhánh `feat/mainnet` chưa push). Đọc kỹ trước khi push
thì thấy hai lỗi, cả hai đều chỉ lộ ra khi chạy thật:

1. **`pnpm/action-setup@v4` thiếu `package_json_file: fe/package.json`.**
   `defaults.run.working-directory` CHỈ áp cho step `run:`, KHÔNG áp cho step `uses:`. Action vì thế
   đọc `package.json` ở GỐC repo — mà gốc CỐ Ý không có `packageManager` (monorepo "git chung, build
   riêng", CLAUDE.md §1). Kết quả: chết ở bước 2 với *"No pnpm version is specified"*, trước cả
   `install`. Comment ngay trên nó lại khẳng định "action đọc packageManager trong fe/package.json"
   — sai. `ci-fe.yml` làm đúng từ đầu ở cả 3 chỗ; bản port sang `deploy-fe.yml` rơi mất dòng này.

2. **Không ai set `VITE_APP_NAME`.** Hai hậu quả, đo thật chứ không suy luận:
   - `apps/web/index.html` dùng token `%VITE_APP_NAME%`. Vite 8 khi thiếu key thì `return text`
     (nguồn: `vite/dist/node/chunks/node.js`) — chỉ warn, KHÔNG fail. Tab trình duyệt production
     hiện đúng chữ `%VITE_APP_NAME%`.
   - Phía JS, `env.ts` có `.default("Mau Demo FE")` → `features/wallet/lib/kit.ts` lấy làm `rpName`
     → **hộp thoại vân tay/Face ID trên máy người dùng ghi "Mau Demo FE"**.
   Chứng minh: bản build đầu (không set biến) ra `<title>Mau Demo FE</title>` + chuỗi đó nằm trong
   `assets/env-*.js`. Set `APP_NAME: FamilyHaven` rồi build lại → `<title>FamilyHaven</title>`.
   Khác `rpId`: `rpName` ĐỔI ĐƯỢC sau, không nhúng vào credential.

Đã thêm 2 gate mới vào "Verify dist" để không tái diễn: chặn mọi token `%VITE_*%` còn sót, và chặn
chuỗi `Mau Demo FE` trong dist.

