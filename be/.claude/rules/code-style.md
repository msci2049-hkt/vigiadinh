# Luật code — FamilyWallet (thừa kế từ 2 template mẫu)

## Chung
- TypeScript strict, không `any`, không `@ts-ignore`. Comment/tài liệu tiếng Việt; tên biến/hàm + mã lỗi tiếng Anh.
- File ≤300 dòng, component ≤200 dòng (quy ước — reviewer bắt).
- Validate mọi input bằng Zod (body, params, env).

## Backend (Bun + Hono — degit mau-demo-be)
- Mọi lệnh `bun`/`bunx`. Drizzle: migration forward-only, sinh bằng drizzle-kit, KHÔNG sửa tay, CẤM `drizzle-kit push`. CHECK constraints thay enum.
- Module theo Vertical Slice như `modules/product`. Job nền qua BullMQ, worker tiến trình riêng, chống trùng bằng `jobId`.
- Webhook/cron trong template là code mẫu CHƯA nối dây — muốn dùng phải dựng đủ (HMAC chống timing, timestamp chống replay, unique index chống trùng).
- Session cookie Better Auth; client không bao giờ gửi được `role`.

## Frontend (Vite — degit mau-demo-fe-vite)
- pnpm 9 + Node 20 (FE) — đừng bê tsconfig giữa FE (TS 6) và BE (TS 5.9).
- **Chỉ `pnpm build` (honest build) được tính là bằng chứng build.** `vite build`/`turbo build` không tính. `packages/config` chỉ export `.mjs`/`.json`.
- Cấm feature import feature; dữ liệu server ở TanStack Query, Zustand chỉ giữ UI state; cấm `fetch()` trần — qua `apiClient`; `routeTree.gen.ts` không sửa tay.
- i18n: mọi chuỗi qua key (vi/en tối thiểu; en mặc định bản quốc tế). Cấm hardcode chữ trong JSX.
- Thiếu `.env` = trang trắng không báo lỗi — mọi hướng dẫn setup phải có bước `cp .env.example .env`.

## Git & CI
- Cấm `--force`, `--no-verify`. Lefthook: pre-commit lint+secret, pre-push build thật. CI đỏ khi: typecheck/lint/test/build đỏ, CVE high/critical, secret trong lịch sử.
