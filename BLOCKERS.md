# BLOCKERS

Việc KHÔNG tự làm xong được trên máy hiện tại. Mỗi mục ghi: chặn cái gì, vì sao,
cần ai/cái gì để gỡ. Không mục nào ở đây được coi là "đã xanh".

> ⚠️ **MỌI SHA ghi trước 2026-07-24 trong file này KHÔNG CÒN HIỆU LỰC** — lịch sử đã rewrite
> 2026-07-23 (gộp scaffold, 136 → 16 commit; cây làm việc không đổi một byte).
> Chi tiết + bảng tra: `BUILD-LOG.md` đầu file. Lịch sử cũ nằm ngoài repo:
> `../family-wallet-backup-full.bundle` (repo chỉ còn nhánh `main`).

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

- **Chặn:** chưa chứng minh kit ký được tx mà `__check_auth` của `contracts/smart-account`
  (OZ 0.7.2, SDK 26.1.1) chấp nhận — kit nhắm bản OZ mới hơn (bindings 0.3.0, P27 digest
  + context-rule-ids binding).
- **Dấu hiệu sẽ lộ:** e2e passkey CI (simulate deploy bằng wasm hash của ta
  `87194f61…`) fail ở bước dựng constructor args, HOẶC PHA 5 khi ký tx thật.
- **Cần để gỡ:** chạy e2e CI; nếu lệch → nâng OZ crates khi bản tương thích SDK 27 ra
  (đã ghi §0.4 checklist) hoặc pin kit bản cũ hơn khớp 0.7.2.
