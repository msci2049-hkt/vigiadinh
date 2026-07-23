# HARDENING — 7 hạng mục production-grade (FE monorepo)

> Thêm trong đợt hardening 2026-07-10 (branch `feat/core-hardening`).
> Việc còn lại cho con người: `docs/HUMAN-TODO.md`. Skill tái dùng:
> `.claude/skills/{build-safety-cloudflare, sentry-frontend, supply-chain-guard}`.

## Đã thêm gì

| WP | Nội dung | Ở đâu |
|---|---|---|
| WP1 | `pnpm build` = HONEST build mặc định (wrapper version-aware); `.nvmrc` 20; lefthook pre-commit (guard-ts + biome + gitleaks) + pre-push (`pnpm build`); deploy cách B qua wrangler; rule bất biến | `scripts/honest-build.mjs`, `lefthook.yml`, `.github/workflows/deploy.yml`, `.claude/rules/build.md`, `.nvmrc`, `.gitattributes` |
| WP5 | Sentry 2 app: tracing (kèm Web Vitals) + replay + error boundary + setUser + source map hidden-upload-rồi-xoá + trace FE→BE | `apps/*/src/instrument.ts`, `main.tsx`, `app/provider.tsx`, `app/routes/__root.tsx`, `packages/config/vite.preset.mjs`, `turbo.json` |
| WP6 | Renovate (không auto-bump better-auth) + audit gate `pnpm audit --audit-level=high` (đang SẠCH — chặn thật) | `renovate.json`, `ci.yml` job supply-chain, `deploy.yml` |
| WP7 | gitleaks: hook + CI full-history + pattern SePay | `.gitleaks.toml`, `lefthook.yml`, `ci.yml` job secrets-scan |

CI cũ (matrix Node 20/22/24 honest gate + guard host-loaded + e2e) giữ nguyên.

## Cách hoạt động

- **Build ở bất kỳ đâu**: `pnpm build` → wrapper tự thêm
  `--no-experimental-strip-types` (Node ≥22.6) + `turbo build --force`
  → local hành xử như host Node 20 sạch (Cloudflare CI). Build "thường"
  không còn tồn tại như lệnh mặc định.
- **Commit**: guard-ts + biome (staged) + gitleaks. **Push**: honest build,
  đỏ = chặn ngay tại máy.
- **Deploy (cách B, sau khi kích hoạt theo HUMAN-TODO)**: push main → CI
  honest build (Node theo .nvmrc) → audit gate → `wrangler@4 pages deploy`
  dist của web + carbon; PR → preview `<branch>.<project>.pages.dev`.
  Thiếu secrets Cloudflare → job vẫn xanh, deploy SKIP có notice.
- **Sentry**: chỉ bật PROD + có `VITE_SENTRY_DSN`. Source map chỉ sinh khi
  build CI có `SENTRY_AUTH_TOKEN` (upload xong xoá — dist không bao giờ chứa .map).

## Verify (đã chạy — lặp lại được)

```bash
pnpm verify        # validate (guard + biome ci + typecheck + boundaries) + honest build
# Bộ sabotage chuẩn (bằng chứng hệ thống còn sống):
#  1. thêm export "./sabotage": "./x.ts" vào packages/config + import ở apps/web/vite.config.ts
#  2. plain `turbo run build --force` (Node 24)   → XANH GIẢ (exit 0)  ← lý do tồn tại honest build
#  3. pnpm guard:host-loaded                       → ĐỎ, chỉ đúng file
#  4. pnpm build                                   → ĐỎ ERR_UNKNOWN_FILE_EXTENSION, exit 1
#  5. git push (bare repo local cũng được)          → pre-push CHẶN
#  6. gỡ sabotage → tất cả xanh lại
```

Kết quả đợt này: đủ 6 bước trên pass đúng chiều; commit key SePay giả bị
pre-commit chặn; full history 17 commit 0 leak; `pnpm audit` 0 vulnerability;
unit test 4/4 workspace xanh.

## Áp cho dự án mới clone template

1. `corepack pnpm install` (prepare tự cài hook — LUÔN dùng `corepack pnpm`
   để ăn đúng pnpm pin trong `packageManager`).
2. Cài gitleaks binary (HUMAN-TODO §3).
3. Làm 5 mục HUMAN-TODO (Cloudflare + secrets + Renovate + Sentry DSN).
4. Chạy bộ sabotage 6 bước một lần để tin guard còn sống.

## Cập nhật 2026-07-10 (merge OTP + fix e2e)

- Merge `feat/email-otp-verification` (sign-up→verify OTP; forgot→reset OTP;
  `input-otp` ở `packages/ui`). Sentry `setUser` + luồng OTP cùng tồn tại — không
  đạp nhau (setUser sync tập trung ở `use-current-user`, không nằm trong login-form web).
- `pnpm audit --audit-level=high` SẠCH (gate chặn thật trong ci.yml + deploy.yml).
- BUG-006/007 (ERRORS.md): selector OTP `input[data-input-otp]` (KHÔNG phải
  `[data-slot="input-otp"]` — Radix Slot của FormControl ghi đè); e2e local phải
  `cp .env.example .env` cho từng app trước khi chạy.
- e2e chromium: web 20/20 (gồm 6 OTP), carbon 5/5.
