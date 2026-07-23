---
name: new-module
description: Tạo module nghiệp vụ mới. Tự chọn Layered hoặc Vertical Slice theo số endpoint. Dùng khi user gõ "tạo module", "thêm module", "create module".
---

# New module workflow (Hybrid pattern)

Xem `.claude/rules/module-boundary.md` để biết decision tree đầy đủ.

## Bước 1 — Đếm endpoint dự kiến

Hỏi user mô tả module + list endpoint cần có. Quyết:

| Module có | Pattern |
|---|---|
| < 5 endpoint | **Layered** |
| ≥ 5 endpoint | **Vertical Slice** |
| Không rõ | HỎI user |

## Bước 2A — Nếu LAYERED

Tạo cấu trúc:

```
src/modules/<name>/
├── types.ts             # TS types nội bộ
├── dto.ts               # Zod cho mọi endpoint
├── service.ts           # Logic nghiệp vụ (≤ 300 dòng)
├── routes.ts            # Hono
└── service.test.ts      # Test
```

- Schema Drizzle: tạo `src/modules/<name>/infra/<name>.schema.ts` (hoặc giữ ở `src/db/schema/` nếu nhỏ).
- Re-export schema trong `src/db/schema/index.ts`.

## Bước 2B — Nếu VERTICAL SLICE

Tạo cấu trúc:

```
src/modules/<name>/
├── index.ts                       # Public facade
├── domain/
│   ├── <name>.entity.ts
│   ├── validators.ts              # Zod field shared
│   └── errors.ts                  # Domain errors
├── infra/
│   ├── <name>.schema.ts           # Drizzle table
│   └── <name>.repository.ts       # DB query shared
├── features/
│   ├── <feature1>/
│   │   ├── dto.ts
│   │   ├── handler.ts             # Hono route + logic
│   │   └── handler.test.ts
│   └── <feature2>/ …
├── integration-events.ts          # Module augmentation @/lib/events
└── routes.ts                      # Wire features
```

Tham khảo: `src/modules/product/` là reference implementation.

Re-export schema từ `src/db/schema/index.ts` để Drizzle Kit nhìn thấy:

```ts
export * from "../../modules/<name>/infra/<name>.schema";
```

`integration-events.ts` pattern:

```ts
import "@/lib/events";
declare module "@/lib/events" {
  interface DomainEvents {
    "<name>.created": { /* ... */ };
  }
}
export {};
```

> Consumer `eventBus.on(...)` PHẢI **sync cùng-request** (no async/await/I/O). Durable → BullMQ. Xem `.claude/rules/events.md` (enforce ở `check:boundaries`).

`index.ts` (public facade) — CHỈ export type + integration events:

```ts
import "./integration-events";
export type { <Entity> } from "./domain/<name>.entity";
```

## Bước 3 — Mount routes vào `src/app.ts`

```ts
app.route("/api/<name>", <name>Routes);
```

## Bước 4 — Migration

- `bun run db:generate`
- ĐỌC SQL trong `drizzle/<ts>_*.sql` — không có DROP COLUMN ngoài ý muốn
- `bun run db:migrate`
- Verify bảng mới trong DB

## Bước 5 — Test

- `bun run validate` (typecheck + biome + **check:boundaries**)
- Curl test mỗi endpoint:
  - No-auth → **401** (KHÔNG 404)
  - Valid input → 200/201
  - Invalid input → 422

## Bước 6 — Update `CODE_BASE_MAP.md`

## Anti-patterns

- ❌ Tạo file lẻ trong `src/` không thuộc module
- ❌ `service.ts` > 300 dòng mà vẫn dùng Layered → refactor sang Slice
- ❌ Cross-module deep import (`@/modules/X/features/...`) — vi phạm boundary
- ❌ Module không có `.test.ts` (rule 11 CLAUDE.md)
