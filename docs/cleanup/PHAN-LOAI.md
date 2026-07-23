# PHÂN LOẠI toàn bộ file (PHA 1.5 §6 — 2026-07-23)

> Điều kiện XOÁ phải đủ CẢ BỐN: (1) knip/grep 0 tham chiếu sau khi gỡ điểm nối, (2) không thuộc §3,
> (3) không thuộc §4, (4) không trong ROUTES.md v1. Thiếu một → NGỜ (mặc định GIỮ).
> knip: BE 0 unused file · FE 6 unused file (4 trong đó là GIỮ có chủ đích — xem NGỜ/§4).
> Báo cáo thô: `knip-be.json`, `knip-fe.json` cùng thư mục.

## Tổng kết

| Loại | Số file |
|---|---|
| XOÁ | 9 |
| NGỜ (mặc định GIỮ) | 17 |
| GIỮ | 273 |
| **Tổng .ts/.tsx (be/src + fe/apps + fe/packages)** | **299** |

## Ngoài bảng .ts/.tsx (quyết định kèm)

| Thứ | Loại | Bằng chứng |
|---|---|---|
| `fe/apps/web/src/app/routes/index.tsx` + `config/site.ts` | SỬA (không xoá) | gỡ import HealthBadge + block 🧪 DEMO + nav /dashboard theo README §Gỡ demo |
| `fe/apps/web/e2e/auth.spec.ts` + 2 test demo trong `smoke.spec.ts` | SỬA/XOÁ phần demo | test đăng nhập đi vào /dashboard demo — trỏ sang route thật hoặc xoá, khai báo số test trong commit |
| `fe/apps/web/src/locales/*/dashboard.json` + key liên quan | XOÁ cùng lô 4 | README: lazy, không vào bundle; xoá kèm bỏ khỏi I18nResources trong lib/i18n.ts |
| `fe/scripts/init-project.mjs`, `be/scripts/init-project.mjs` | NGỜ→GIỮ | knip FE báo unused nhưng README + .claude/rules/new-project.md + TEMPLATE-PRIMER tham chiếu |
| `fe/apps/web/scripts/verify-real-login.mjs` | NGỜ→GIỮ | công cụ bằng chứng login thật (commit bd08a86 dùng); knip báo unused nhưng là tooling tay |
| `fe/packages/config/vite.preset.d.mts` | GIỮ | type declaration cho vite.preset.mjs (knip false positive) |
| Dependency knip báo unused — BE: @stellar/stellar-sdk, @simplewebauthn/server, firebase-admin, redlock, ofetch, rate-limiter-flexible · FE: @stellar/stellar-sdk, @simplewebauthn/browser, hono, @testing-library/user-event, @testing-library/react (mới lộ sau lô 4 — test RTL duy nhất là health-badge.test đã xoá; khung test component PHA 6) | GIỮ hết (lô 6 = rỗng) | §4: stellar-sdk (PHA 5 import — nâng version, không gỡ), simplewebauthn (PHA 2 passkey), firebase-admin (FCM PHA 4/8), redlock (cron 12:00 PHA 4), ofetch (skill call-external-api), rate-limiter-flexible (hạ tầng), hono (rpc.ts scaffold PHA 6), user-event (khung test) |
| Biến env `R2_*`, `RESEND_*` | GIỮ | §4/§6: RESEND cần cho notify email PHA 4.3; R2 = NGỜ (backup db-backup skill dùng R2) — không đụng |
| Script `test:e2e` fe | GIỮ | KHÔNG chết: fe→turbo→apps/web `playwright test` đủ dây (khác ghi nhận cũ trong prompt) |
| Tài liệu template (`be/docs/TEMPLATE-PRIMER-BE.md`, `fe/docs/TEMPLATE-PRIMER-FE.md`, TEMPLATE-DEVIATIONS, RESET-REPORT) | GIỮ | CLAUDE.md 2 bên tham chiếu làm nền tra cứu template; không phải "docs của mau-demo" mồ côi |

## Bảng từng file

| Đường dẫn | Loại | Bằng chứng |
|---|---|---|
| `be/src/app.ts` | GIỮ | §3 — mount order + CSP fail-closed |
| `be/src/cluster.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/db/index.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/db/schema/auth.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/db/schema/index.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/env.schema.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/env.schema.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/env.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/index.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/access-control.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/auth.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/email.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/enqueue.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/events.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/logger.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/password-hash.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/password-hash.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/pool-budget.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/pool-budget.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/realtime-core.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/realtime-core.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/realtime.integration.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/realtime.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/redis.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/redlock.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/resend.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/semaphore.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/semaphore.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/sentry.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/signup-role-guard.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/lib/signup-role-guard.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/storage.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/lib/validation-limits.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/auth.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/error.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/hash-guard.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/middlewares/hash-guard.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/rate-limit.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/raw-body.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/middlewares/validator.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/modules/guardians/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/domain/guardian.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/features/list-guardians/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/features/list-guardians/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/guardians/features/list-guardians/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/infra/guardians.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/infra/guardians.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/guardians/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/domain/audit.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/features/list-audit/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/features/list-audit/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/indexer/features/list-audit/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/infra/audit-log.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/infra/indexer.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/indexer/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/domain/inheritance.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/features/list-heirs/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/features/list-heirs/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/inheritance/features/list-heirs/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/infra/heartbeats.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/infra/heirs.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/infra/inheritance.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/inheritance/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/domain/notification.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/features/list-notifications/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/features/list-notifications/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/notifications/features/list-notifications/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/infra/notifications.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/infra/notifications.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/notifications/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/domain/presence.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/features/list-pings/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/features/list-pings/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/presence/features/list-pings/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/infra/devices.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/infra/presence-pings.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/infra/presence.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/presence/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/product/domain/errors.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/domain/product.entity.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/domain/validators.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/create-product/dto.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/create-product/handler.test.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/create-product/handler.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/delete-product/handler.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/get-product/handler.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/list-products/handler.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/update-product/dto.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/features/update-product/handler.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/index.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/infra/product.repository.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/infra/products.schema.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/integration-events.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/product/routes.ts` | NGỜ | GIỮ — khuôn Vertical Slice đã unmount; be/CLAUDE.md dặn giữ làm mẫu; knip: referenced; xoá cân nhắc SAU PHA 5 khi module thật đã dựng |
| `be/src/modules/realtime/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/domain/recovery.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/features/list-requests/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/features/list-requests/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/recovery/features/list-requests/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/infra/recovery-requests.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/infra/recovery.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/recovery/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/domain/risk.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/features/get-engine-status/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/features/get-engine-status/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/risk/features/get-engine-status/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/risk/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/domain/errors.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/domain/validators.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/domain/wallet.entity.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/features/get-wallet/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/features/list-wallets/dto.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/features/list-wallets/handler.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/modules/wallets/features/list-wallets/handler.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/index.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/infra/wallets.repository.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/infra/wallets.schema.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/modules/wallets/routes.ts` | GIỮ | §4 — bề mặt API FamilyWallet (route GET đọc bảng, PHA 5/6 nối); knip: referenced |
| `be/src/services/webhooks/verify.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/shared-contract/api-envelope.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/shared-contract/contract.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/shared-contract/enums.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/shared-contract/index.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/shared-contract/intent.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/shared-contract/sse.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `be/src/test-support/pg.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `be/src/types/hono.d.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/types/redlock.d.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `be/src/workers/index.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/e2e/admin.spec.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/e2e/auth.spec.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/e2e/otp.spec.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/e2e/smoke.spec.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/playwright.config.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/app/provider.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/app/routeTree.gen.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/app/router.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/app/routes/__root.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/_admin/admin/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/_admin/admin/sessions.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/_admin/admin/settings.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/_admin/admin/users.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/_admin/route.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/block/confirm.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/block/done.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/block/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/dashboard.tsx` | XOÁ ✅ 2026-07-23 | lô 4 — route demo 🧪 gọi /api/dashboard/summary KHÔNG tồn tại (404); ROUTES.md đánh N; README §Gỡ demo |
| `fe/apps/web/src/app/routes/_authenticated/guardian/approve-warning.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/guardian/approve.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/guardian/approved.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/guardian/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/guardians/$guardianId.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/guardians/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/inheritance/claim.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/inheritance/heartbeat.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/inheritance/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/alert.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/guardian-view.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/log.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/resolve.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/night-watch/waiting.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/route.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/assistant.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/choose-guardians.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/done.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/invite.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/review.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/threshold.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/setup/timelock.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/wallet/history.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/wallet/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/wallet/receive.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/_authenticated/wallet/send.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/forgot-password.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/get-started.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/login.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/passkey.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/countdown.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/done.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/find-wallet.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/index.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/progress.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/recovery/sent.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/reset-password.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/sign-up.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/unauthorized.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/verify-email.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/app/routes/welcome.tsx` | GIỮ | ROUTES.md bảng A — v1=Y (khung ScreenStub, PHA 6 thay ruột) |
| `fe/apps/web/src/components/command-menu.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/components/language-switcher.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/components/panel-shell.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/components/screen-stub.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/components/theme-toggle.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/components/update-toast.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/config/site.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/forgot-password-form.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/impersonation-banner.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/login-form.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/reset-password-form.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/signup-form.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/user-menu.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/components/verify-email-form.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/hooks/use-current-user.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/schemas/login-schema.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/apps/web/src/features/auth/schemas/login-schema.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/schemas/otp-schema.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/auth/schemas/signup-schema.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/apps/web/src/features/auth/schemas/signup-schema.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/dashboard/api/dashboard-api.ts` | XOÁ ✅ 2026-07-23 | lô 4 — API demo 🧪, endpoint không tồn tại; README §Gỡ demo |
| `fe/apps/web/src/features/dashboard/components/dashboard-summary-card.tsx` | XOÁ ✅ 2026-07-23 | lô 4 — component demo 🧪; README §Gỡ demo |
| `fe/apps/web/src/features/dashboard/components/events-feed.tsx` | XOÁ ✅ 2026-07-23 | lô 4 — demo 🧪; mẫu SSE giữ trong git history + skill consume-sse; README §Gỡ demo |
| `fe/apps/web/src/features/dashboard/hooks/use-dashboard.ts` | XOÁ ✅ 2026-07-23 | lô 4 — hook demo 🧪; README §Gỡ demo |
| `fe/apps/web/src/features/health/api/health-api.ts` | XOÁ ✅ 2026-07-23 | lô 4 — health demo 🧪 nối-BE của template; README §Gỡ demo |
| `fe/apps/web/src/features/health/components/health-badge.test.tsx` | XOÁ ✅ 2026-07-23 | lô 4 — test của health demo (xoá cùng màn, khai báo trong commit) |
| `fe/apps/web/src/features/health/components/health-badge.tsx` | XOÁ ✅ 2026-07-23 | lô 4 — health demo 🧪; README §Gỡ demo |
| `fe/apps/web/src/features/health/hooks/use-health.ts` | XOÁ ✅ 2026-07-23 | lô 4 — health demo 🧪; README §Gỡ demo |
| `fe/apps/web/src/features/users-management/api/admin-users-api.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/components/create-user-dialog.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/components/user-dialogs.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/components/user-row-actions.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/components/users-table.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/hooks/use-user-mutations.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/hooks/use-users-table.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/index.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/features/users-management/pages/users-page.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/instrument.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/api-client.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/auth-client.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/env.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/i18n.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/query-client.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/lib/rpc.ts` | NGỜ | GIỮ — scaffold Hono RPC (knip báo unused) nhưng là nền PHA 6.2 API client typed; README+skill connect-api tham chiếu |
| `fe/apps/web/src/lib/sse.ts` | NGỜ | GIỮ — sau lô 4 knip báo unused (consumer duy nhất là demo events-feed đã xoá); §4: nền SSE cho night-watch PHA 6, cặp với packages/core/src/sse.ts (useServerEvents + test) |
| `fe/apps/web/src/lib/validation-limits.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/main.tsx` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/test/setup.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/types/i18next.d.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/src/vite-env.d.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/apps/web/vite.config.ts` | GIỮ | knip: referenced (0 unused file) — hạ tầng khung |
| `fe/packages/auth/src/access-control.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/auth/src/auth-client.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/auth/src/guards.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/auth/src/index.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/auth/src/panels.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/auth/src/session.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/src/api-client.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/packages/core/src/api-client.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/src/contract/contract.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `fe/packages/core/src/contract/intent.ts` | GIỮ | §4 — hợp đồng BE↔FE (shared/ root là nguồn, PHA 5/6 dùng) |
| `fe/packages/core/src/index.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/src/query-client.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/src/sse.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/packages/core/src/sse.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/src/use-debounced-value.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/core/vitest.config.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/packages/i18n/src/index.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/i18n/src/init.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/badge.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/button.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/card.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/dialog.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/dropdown-menu.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/form.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/input-otp.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/input.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/label.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/select.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/separator.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/skeleton.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/sonner.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/components/table.tsx` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/index.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/lib/utils.test.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
| `fe/packages/ui/src/lib/utils.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/src/theme-store.ts` | GIỮ | §3 — packages/{auth,config,core,i18n,ui} là chỗ nhét PlatformAdapter 3 vỏ |
| `fe/packages/ui/vitest.config.ts` | GIỮ | §4 — hạ tầng test là khung đổ test nghiệp vụ |
