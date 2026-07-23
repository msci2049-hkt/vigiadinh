# HARDENING — 7 hạng mục production-grade (BE)

> Thêm trong đợt hardening 2026-07-10 (branch `feat/core-hardening`).
> Việc còn lại cho con người: `docs/HUMAN-TODO.md`. Skill tái dùng:
> `.claude/skills/{hono-secure-headers, graceful-shutdown-readiness, supply-chain-guard}`.

## Đã thêm gì / đã có sẵn gì

| WP | Trạng thái | Ở đâu |
|---|---|---|
| WP1 hook + build-safety | **THÊM** lefthook (husky/lint-staged trước đó KHÔNG wire) | `lefthook.yml`, `package.json` (prepare) |
| WP2 secureHeaders + csrf | **THÊM** | `src/app.ts` §1.5–1.6 |
| WP3 graceful shutdown | Đã có sẵn; **THÊM** trần drain 10s + force-close (SSE treo vô hạn) | `src/index.ts` |
| WP4 /health + /ready | **Đã có sẵn từ trước** — chỉ verify | `src/app.ts` §6–7 |
| WP5 (phía BE) | **THÊM** `sentry-trace`+`baggage` vào CORS allowHeaders | `src/app.ts` §1 |
| WP6 renovate + audit | **THÊM** (repo trước đó KHÔNG có CI) | `renovate.json`, `.github/workflows/ci.yml` |
| WP7 gitleaks | **THÊM** | `.gitleaks.toml`, hook trong `lefthook.yml`, job secrets-scan |
| Bonus | `.gitattributes eol=lf` (bẫy CRLF Windows làm biome đỏ toàn repo) | `.gitattributes` |

## Cách hoạt động

- **Commit**: lefthook pre-commit chạy song song biome (staged) + gitleaks
  (staged) + check:boundaries. Đỏ = không commit được.
- **Push**: pre-push chạy `bun run validate` (typecheck + biome + boundaries
  + env-parity). Đỏ = không push được.
- **CI** (GitHub Actions, push/PR vào main): job `validate` (bun 1.3.11 pin,
  frozen lockfile) + audit report-only; job `secrets-scan` quét FULL history
  bằng gitleaks CLI (không dùng gitleaks-action — đòi license cho org).
- **Runtime**: mọi response có HSTS/nosniff/XFO DENY/CSP 'none'/CORP;
  /api/* có CSRF origin-check; SIGTERM drain ≤10s rồi force-close phần treo
  (SSE), đóng pg pool + 2 redis + realtime, exit 0.

## Verify (đã chạy trong đợt hardening — lặp lại được)

```bash
bun run validate                 # 4 gate xanh
bun test                         # unit xanh; test "(Postgres thật)" cần infra
gitleaks git --redact --no-banner .   # full history: 0 leak (sau allowlist fixture)
# PoC headers/csrf/ready: xem .claude/skills/hono-secure-headers (bộ 6 case app.request)
# PoC SIGTERM: xem .claude/skills/graceful-shutdown-readiness (stack Docker cô lập)
```

Kết quả đợt này (bằng chứng thô trong report phiên hardening):
- 6/6 case headers/csrf đúng; /ready 200↔503 đúng theo trạng thái Dragonfly.
- SIGTERM: không SSE → exit 0 trong <1.5s; SSE sống → force-close đúng 10.0s,
  exit 0 tổng 10.8s.
- Commit key `sepay_..._prod_...` giả → pre-commit CHẶN (exit 1).
- `bun audit`: 24 advisory (1 critical) — chi tiết + kế hoạch: HUMAN-TODO §3.

## Áp cho dự án mới clone template

1. Clone → `bun install` (prepare tự cài hook). Cài gitleaks binary.
2. Secrets thật KHÔNG BAO GIỜ vào git — `.env` đã ignore, gitleaks chặn tay nhanh.
3. Thêm pattern secret của provider mới vào `.gitleaks.toml` ([[rules]]).
4. Thêm queue/worker/connection mới → nối vào shutdown (skill
   graceful-shutdown-readiness §"Khi thêm resource mới").
5. Route trả HTML mới → mở CSP riêng cho route đó, KHÔNG nới CSP toàn cục.
6. Bật Renovate app + set audit gate blocking sau khi deps sạch (HUMAN-TODO).

## Cập nhật 2026-07-10 (đợt vá CVE + merge OTP)

- `bun audit --audit-level=high` **SẠCH**; gate `.github/workflows/ci.yml` đã CHẶN
  THẬT (bỏ `continue-on-error`). Chi tiết bump: commit `fix(security): vá toàn bộ CVE`.
- Còn 5 advisory **moderate/low** (không chặn gate): esbuild ×2 (drizzle-kit, chỉ
  ảnh hưởng dev-server), js-yaml (cosmiconfig), @opentelemetry/core (pin cứng bởi
  sdk-node 0.217), uuid (exceljs). Vá khi parent release — Renovate sẽ mở PR.
- Merge `feat/email-otp-verification`. PoC OTP e2e (stack Docker + Mailhog thật):
  sign-up→OTP→verify, forget→OTP→reset, mật khẩu cũ 401, email-ma vẫn 200
  (chống enumeration), brute-force bị chặn. **Lưu ý**: từ BA 1.6.21 rate-limit chạy
  TRƯỚC handler → brute-force OTP trả **429**, không phải 403 `TOO_MANY_ATTEMPTS`
  (`.claude/rules/auth.md` đã cập nhật; FE phải xử lý cả hai mã).
