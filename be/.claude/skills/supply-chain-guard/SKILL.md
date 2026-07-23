---
name: supply-chain-guard
description: Dựng/sửa hàng rào supply-chain cho repo JS: Renovate auto-PR update deps (trừ better-auth), audit gate CVE trong CI (pnpm audit / bun audit), gitleaks chống commit secret (pre-commit + CI full-history). Dùng khi user nói "setup renovate", "update deps tự động", "audit CVE", "chặn secret", "gitleaks", "dependency vulnerability", "CI security gate". Chứa gotchas thật: gitleaks protect đã deprecated (dùng gitleaks git --pre-commit --staged), gitleaks-action đòi license cho org repo (dùng CLI miễn phí), renovate schedule Later-text deprecated (dùng cron), bun update có thể vỡ typecheck vì nested ioredis, allowlist fixture theo GIÁ TRỊ không theo file.
---

# Supply-chain guard: Renovate + audit gate + gitleaks

## Renovate (`renovate.json` — đã có ở root)

- `config:recommended` + `group:monorepos` + `:semanticCommits`.
- **Không auto-bump `better-auth`/`@better-auth/*`** (`enabled: false`) vì
  update auth = đổi hành vi đăng nhập âm thầm — đọc changelog tay rồi bump
  qua quy trình riêng.
- Schedule dùng **cron** `* 0-5 * * 1` (sáng thứ 2). Cú pháp chữ
  ("before 6am on monday") vẫn chạy nhưng ĐÃ DEPRECATED — viết mới bằng cron;
  phút PHẢI là `*`.
- `vulnerabilityAlerts` bỏ qua schedule/limit (security PR nhảy hàng) và chỉ
  hoạt động khi repo GitHub bật Dependency graph + Dependabot alerts.
- Việc con người: bật Renovate GitHub App cho repo.

## Audit gate

- **pnpm** (FE): `pnpm audit --audit-level=high` — exit ≠ 0 CHỈ khi có
  high/critical (đã verify hành vi pnpm 9/11). Đặt trong CI job riêng +
  trước deploy. Chú ý: dòng summary vẫn IN tổng mọi severity — đừng grep
  summary, tin exit code.
- **bun** (BE): `bun audit --audit-level=high` — có từ bun 1.2.15+.
- Gate đang đỏ vì deps cũ? Đừng continue-on-error mãi: đó là REPORT-ONLY tạm
  thời, ghi rõ điều kiện flip blocking (update deps sạch) vào HUMAN-TODO,
  nếu không gate = trang trí.

## gitleaks

- Lệnh pre-commit HIỆN ĐẠI: `gitleaks git --pre-commit --staged --redact
  --no-banner`. `gitleaks protect`/`detect` deprecated từ v8.19 (còn chạy
  nhưng ẩn khỏi help, sẽ bị gỡ).
- `.gitleaks.toml`: `[extend] useDefault = true` + `[[rules]]` pattern dự án
  (vd SePay: `sepay_[a-z]+_prod_[A-Za-z0-9]{20,}`, thêm `keywords` để nhanh).
- **False positive fixture test**: allowlist theo GIÁ TRỊ
  (`[[allowlists]] regexes = ['''test-secret-...''']`), KHÔNG allowlist cả
  file `*.test.ts` — secret thật dán nhầm vào test vẫn phải bị chặn.
- **CI: dùng gitleaks CLI, không dùng gitleaks-action** — action đòi
  `GITLEAKS_LICENSE` với repo thuộc organization (key free nhưng phải xin +
  thêm secret; thiếu là CI đỏ). CLI MIT quét y hệt:
  checkout `fetch-depth: 0` → tải binary release → `gitleaks git --redact --no-banner`.
- **Quét FULL HISTORY trước khi bật gate CI** — nếu history đã dính secret
  thật thì gate đỏ vĩnh viễn; xử lý trước (allowlist nếu là fixture, ROTATE
  key nếu là secret thật — xoá khỏi history không cứu được key đã lộ).
- Binary phải cài riêng trên máy dev (Go binary, không phải npm package):
  `scoop install gitleaks` / `brew install gitleaks` / tải release zip
  (chú ý: tag có `v`, tên file không — `gitleaks_8.30.1_windows_x64.zip`).
  Thiếu binary → hook fail có fail_text hướng dẫn, KHÔNG silently skip.

## Hook manager (lefthook)

- Cài dạng devDependency + root script `"prepare": "lefthook install"` —
  chạy mọi package manager, né vụ pnpm 10 block postinstall của dep.
- Windows: lefthook v2 chạy command qua `sh` của Git for Windows → viết
  run-string kiểu POSIX được.
- Repo khác branch không có lefthook.yml → hook shim exit 0 kèm warning
  (không chặn nhánh cũ / worktree khác).

## Gotchas update deps (đã trả giá)

- `bun update` toàn cục có thể VỠ TYPECHECK: bullmq mới pin ioredis khác →
  nested `node_modules/bullmq/node_modules/ioredis` → 2 bộ type xung đột
  (`AbstractConnector is not assignable...`). Update CHỌN LỌC từng package,
  validate sau mỗi bước; vỡ thì `git checkout bun.lock && bun install`.
- Advisory của plugin KHÔNG dùng (vd better-auth oidc-provider/mcp) vẫn nằm
  trong audit — đánh giá exposure thật trước khi hoảng, nhưng vẫn bump theo
  quy trình vì audit gate không phân biệt được plugin nào đang bật.

## Điểm mới 2026 (OWASP Top 10:2025 + Bun 1.3)

- **A03 Software Supply Chain Failures** (category MỚI, incidence cao nhất): ngoài renovate + audit + gitleaks
  đã có, bật thêm **Bun `minimumReleaseAge`** (cách ly package vừa publish — chống dependency-confusion / bản độc
  mới đăng) + **Security Scanner API** của Bun 1.3 (chặn install package độc). `--frozen-lockfile` MỌI CI (đã có).
  **Pin exact** cho tool nhạy (compiler, CLI deploy) — không `^`.
- **A10 Mishandling of Exceptional Conditions** (fail-open, category MỚI): nhánh lỗi KHÔNG được bypass authz/
  validation; `catch` rồi `return next()`/cho-qua là lỗ hổng, không phải style. Cờ "mở cửa" default OFF, bật
  tường minh. Xem skill `hono-api-patterns` (error envelope) + rule auth.md (MAJOR-3 dev-token fail-closed).
- **A01 gồm SSRF**: mọi `fetch(url)` với URL do user cấp → allowlist scheme/host, chặn IP metadata nội bộ
  (169.254.169.254, link-local). Xem skill `call-external-api`.
