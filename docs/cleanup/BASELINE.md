# BASELINE — đo trước khi dọn (PHA 1.5 §2, 2026-07-23)

## SHA gốc để rollback

- SHA đo baseline: `1f5a12b2732d4d723571b1c51f16dbc8e859ac28` (sau commit CI, trước ROUTES.md)
- Rollback toàn PHA 1.5: `git revert <sha-commit-BASELINE-này>..HEAD`
- Một file: `git checkout 1f5a12b -- <path>`
- Đã push origin/main trước khi dọn → không có kịch bản mất dữ liệu.

## Test + validate (bằng chứng chạy 2026-07-23)

| Bên | validate | test |
|---|---|---|
| be/ | `bun run validate` XANH (typecheck + biome 165 file + boundaries + env-parity 27 key + contract-check) | `bun test`: **88 pass, 3 skip, 0 fail** — 230 expect, 91 test / 21 file |
| fe/ | `pnpm validate` XANH (11/11 task turbo: host-loaded + validation-parity + user-copy + contract-check + biome ci + typecheck + boundaries) | `pnpm test`: **26 pass, 0 fail** (web 9 + core 14 + ui 3 — đính chính 2026-07-23: lần đo đầu ghi 23 vì task ui cache, log .turbo xác nhận ui 3 test) |

- FE e2e (playwright): CHƯA chạy lại sau merge trên máy này (WSL fail-env KI-2/KI-5 — chỉ chromium
  khả dụng local). Báo cáo cũ trước merge: 20/20 chromium. Verify thật: CI e2e job 3 browser.
- Bẫy môi trường: vitest worker timeout 60s trên /mnt/d — đã vá cục bộ node_modules
  (START_TIMEOUT→600s), mất sau `pnpm i`, chi tiết BUILD-LOG.md PHA 1.3.

## Build (honest build)

- `pnpm build` XANH — 10m03s (WSL /mnt/d), vite built in 1m34s
- Bundle: `fe/apps/web/dist` = **1.2M (1178 KB du -sk)** · PWA precache **77 entries, 1097.36 KiB**

## Kích thước code

- File `.ts/.tsx` (ngoài node_modules): **299** — be/src **149** · fe/apps+fe/packages **150**

## Số liệu so sánh khi nghiệm thu (§8)

- Số test KHÔNG được giảm so với: BE 88 pass · FE unit 26 pass (web 9 + core 14 + ui 3) (trừ lô 3/4 có khai báo trong commit body)
- Bundle so với: 1178 KB / 77 precache entries
