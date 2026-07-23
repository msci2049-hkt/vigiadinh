---
name: sentry-frontend
description: Cài/sửa Sentry cho React SPA (Vite + TanStack Router) đúng chuẩn production — browser tracing (kèm Web Vitals tự động), session replay, error boundary, setUser, source map hidden upload rồi xoá, nối distributed trace FE→BE. Dùng khi user nói "thêm Sentry", "config sentry FE", "sentry không nhận lỗi", "source map sentry", "web vitals", "trace FE sang BE", "lỗi prod không thấy stacktrace". Chứa gotchas thật: tanstackRouterBrowserTracingIntegration THAY browserTracing (gắn cả hai = double instrument), integration cần router instance nên phải addIntegration sau init, CORS BE phải allow sentry-trace/baggage, map chỉ sinh khi sẽ upload.
---

# Sentry FE (React + Vite + TanStack Router)

## Kiến trúc chuẩn (đã dựng sẵn trong template)

- `src/instrument.ts` — Sentry.init, **import ĐẦU TIÊN của main.tsx** (side-effect):
  init sau import khác = miss lỗi lúc boot. Gate: `import.meta.env.PROD && VITE_SENTRY_DSN`
  (dev không bắn noise; thiếu DSN = tắt hẳn, mọi call Sentry.* thành no-op an toàn).
- Tracing: `Sentry.tanstackRouterBrowserTracingIntegration(router)` — cần
  **router instance**, mà router chỉ tồn tại khi `app/provider.tsx` eval →
  init sớm KHÔNG kèm tracing, rồi `attachSentryRouterTracing(router)` (bọc
  `Sentry.addIntegration`) ngay sau `createAppRouter`. Trade-off chấp nhận:
  pageload span bắt đầu trễ vài tick; đổi lại lỗi boot vẫn được bắt sớm.
- Error boundary: TanStack `errorComponent` ở `__root.tsx` gọi
  `Sentry.captureException(error)` trong `useEffect` — **React prod nuốt lỗi
  render/routing sau khi boundary bắt**, không tự báo đi đâu.
- `setUser`: sync TẬP TRUNG ở hook session (web: `use-current-user` — mount
  thường trực qua UserMenu) thay vì rải theo form; app không có mount point
  thường trực (carbon) thì set tại login-success. Chỉ `id`/`role` — không
  email/tên (`sendDefaultPii: false`).
- `tracePropagationTargets: [/^\//, ^VITE_API_URL]` — chỉ inject header trace
  vào request đi BE mình.

## Source map — nguyên tắc "không bao giờ ship map"

`vite.preset.mjs`: `sourcemap: sentryUpload ? "hidden" : false` với
`sentryUpload = SENTRY_AUTH_TOKEN && sentryProject`.
- Có token (CI): sinh map hidden → plugin upload → `filesToDeleteAfterUpload`
  xoá khỏi dist → deploy không có map.
- Không token (local): **không sinh map luôn** — nếu chỉ đặt `hidden` vô điều
  kiện, file .map vẫn nằm trong dist và bị deploy lên (đoán được tên là tải được).
- `sentryVitePlugin` **đứng CUỐI mảng plugins** (yêu cầu của plugin — ngược
  thói quen). Monorepo 2 app = 2 project Sentry → truyền `sentryProject` per-app
  qua env `SENTRY_PROJECT_WEB` / `SENTRY_PROJECT_CARBON` (khai
  `globalPassThroughEnv` trong turbo.json — turbo 2 strict env lọc env lạ).

## Nối trace FE→BE

FE gắn 2 header `sentry-trace` + `baggage` vào request. **BE phải allow trong
CORS `allowHeaders`** — thiếu thì preflight từ chối, browser lặng lẽ bỏ header,
trace đứt mà không có lỗi nào hiện ra. BE template đã thêm sẵn (src/app.ts).

## Gotchas (đã trả giá / dễ dính)

- `tanstackRouterBrowserTracingIntegration` **LÀ** browser tracing — gắn thêm
  `browserTracingIntegration()` nữa = pageload/navigation bị đếm đôi.
- Yêu cầu `@tanstack/react-router >= 1.64`. API kiểu function
  (`browserTracingIntegration()`) là chuẩn từ v8+; code mẫu cũ
  (`new BrowserTracing()`) là v7 — đừng chép.
- Web Vitals (LCP/CLS/INP/TTFB) đi kèm browser tracing — **không cài package
  `web-vitals` riêng**.
- Env schema Zod: `VITE_SENTRY_DSN` phải nhận CẢ chuỗi rỗng
  (`.or(z.literal("").transform(() => undefined))`) — `.env` có dòng
  `VITE_SENTRY_DSN=` trống sẽ fail `z.url().optional()` và sập app lúc boot.
- Feature file import `@sentry/react` trực tiếp là OK (không phá module
  boundary — nó là lib ngoài), nhưng nhớ biome organize imports.
- Verify không cần DSN thật: build với DSN giả đúng format
  (`https://x@o0.ingest.sentry.io/0`) → mở app → ném lỗi từ console → thấy
  envelope POST đi tới `*.ingest.sentry.io` trong Network tab = wiring sống.
  Stacktrace đúng dòng thì phải có DSN + token thật (CI upload map).

## Khi clone template sang dự án mới

1. Tạo 2 project Sentry (web, carbon) → lấy DSN.
2. Secrets/vars CI: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`,
   `SENTRY_PROJECT_CARBON`, `VITE_SENTRY_DSN_WEB/_CARBON` (deploy.yml đã đọc).
3. Không phải sửa code — toàn bộ gate theo env.
