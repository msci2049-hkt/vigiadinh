# Build honest — bất biến

- Lệnh build DUY NHẤT để verify/deploy là `pnpm build` (chạy `scripts/honest-build.mjs`
  → tự thêm `NODE_OPTIONS=--no-experimental-strip-types` trên Node ≥ 22.6 + `turbo run
  build --force`). Lý do: Bun và Node ≥ 23.6 strip type nên nạp được `.ts` config
  cross-package → build xanh GIẢ, nhưng host Node 20/22 sạch (Cloudflare CI) đỏ với
  `ERR_UNKNOWN_FILE_EXTENSION`.
- Claude Code PHẢI chạy `pnpm build` (honest) và thấy nó XANH trước khi báo "xong".
  Không được báo xong dựa trên `vite build` / `turbo run build` thường — hai lệnh đó
  không được coi là bằng chứng build.
- CẤM thêm script build bỏ qua wrapper honest, và CẤM bump Node trong CI để "né" lỗi
  vì strip types sẽ che lại bug. Guard tĩnh `pnpm guard:host-loaded`
  (`scripts/check-host-loaded.mjs`) độc lập runtime — giữ nguyên, chạy trước build.
- File config host-loaded (vite/vitest/playwright preset trong `packages/config`) chỉ
  được import `.mjs`/`.json` cross-package, không bao giờ `.ts` (guard chặn + pre-commit
  lefthook chặn + pre-push chạy `pnpm build` honest chặn lần cuối).
- `--force` là bắt buộc trong honest build: artifact xanh cache từ lần build strip-types
  không bao giờ được replay làm bằng chứng honest.
- Deploy = cách B: CI build honest → `wrangler pages deploy` đẩy `dist/`
  (`.github/workflows/deploy.yml`). Cloudflare KHÔNG build lại.
