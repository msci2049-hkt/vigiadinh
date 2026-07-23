# Module Pattern — Hybrid (Layered + Vertical Slice)

## Quyết định pattern

| Tiêu chí | Layered | Vertical Slice |
|---|---|---|
| Số endpoint | < 5 | ≥ 5 |
| Phức tạp business logic | Đơn giản | Phức tạp |
| `service.ts` dự kiến | < 250 dòng | > 250 dòng |
| Mục tiêu chính | Đơn giản, ít abstraction | Tách feature, dễ thay đổi cục bộ |

Nếu chưa rõ → hỏi user.

## Khi nào upgrade Layered → Slice?

- `service.ts` vượt **250 dòng** (warn), **300 dòng** (BẮT BUỘC)
- Sắp thêm endpoint thứ 5
- Feature mới có workflow > 3 bước
- 2+ feature cần lock theo entity khác nhau / mutex riêng

## Layered structure

```
src/modules/<name>/
├── types.ts             # TS types nội bộ
├── dto.ts               # Zod cho mọi endpoint
├── service.ts           # Logic nghiệp vụ (≤ 300 dòng)
├── routes.ts            # Hono
└── service.test.ts      # Test
```

Schema Drizzle:
- File nhỏ → `src/db/schema/<name>.ts` (rồi re-export trong `index.ts`)
- File lớn → đẩy vào `src/modules/<name>/infra/<name>.schema.ts` (vẫn re-export `src/db/schema/index.ts`)

## Vertical Slice structure

```
src/modules/<name>/
├── index.ts                       # Public facade — chỉ export type + events
├── domain/
│   ├── <name>.entity.ts           # Re-export type từ schema
│   ├── validators.ts              # Zod field shared (status, id, ...)
│   └── errors.ts                  # Constants domain error
├── infra/
│   ├── <name>.schema.ts           # Drizzle table (re-export src/db/schema/index.ts)
│   └── <name>.repository.ts       # DB query shared cho mọi feature
├── features/
│   ├── <feature-a>/
│   │   ├── dto.ts                 # Zod input feature này
│   │   ├── handler.ts             # Hono route + logic feature này
│   │   └── handler.test.ts        # Test feature này
│   └── <feature-b>/ …
├── integration-events.ts          # `declare module "@/lib/events"`
└── routes.ts                      # Wire feature route → 1 Hono
```

## Cross-module communication — 3 cách

### 1. Domain Event (sync, in-memory)

```ts
// Producer
import { eventBus } from "@/lib/events";
eventBus.emit("order.created", { orderId, items });

// Consumer
eventBus.on("order.created", async (e) => { /* ... */ });
```

Dùng khi: trigger hậu cần đơn giản, không cần retry/persist.

### 2. Integration Event qua BullMQ (async, retry)

```ts
import { stockQueue } from "@/jobs/queues";
await stockQueue.add("reduce-stock", { orderId });
```

Dùng khi: side-effect quan trọng (giảm tồn kho, gửi email), cần retry/dead-letter.

### 3. Public Facade Import (sync, hạn chế)

```ts
import { type Product } from "@/modules/product";
```

Dùng khi: query đơn giản, đọc type. KHÔNG dùng cho write/side-effect.

## DRY trong module

- File trùng tên (`dto.ts`, `handler.ts` ở mỗi feature) là **convention**, không phải duplicate.
- Logic LẶP THẬT SỰ ≥ 3 lần → tách:
  - `domain/<entity>.ts` — business rule shared
  - `domain/validators.ts` — Zod field reusable
  - `infra/<name>.repository.ts` — DB query shared
- **Rule of Three**: chờ đủ 3 lần lặp mới abstract — premature abstraction tệ hơn duplicate.

## Anti-patterns

- ❌ Deep import cross-module: `@/modules/X/features/...`, `/infra/...`, `/domain/...`
- ❌ Module nhỏ 2 endpoint mà vẫn dùng Slice → ngợp ngụa folder
- ❌ Module ≥ 5 endpoint mà giữ Layered → service.ts phình > 300 dòng
- ❌ Subscribe event ở giữa feature handler → đẩy subscribe vào init phase
- ❌ Emit event bên trong DB transaction → consumer xử lý trước commit → race

## Examples

### Module nhỏ — Layered

`brand` (chỉ CRUD đơn giản):

```
src/modules/brand/
├── types.ts
├── dto.ts
├── service.ts       # 4 endpoint: list/get/create/update (< 200 dòng)
├── routes.ts
└── service.test.ts
```

### Module phức tạp — Vertical Slice

`order` (8 endpoint, workflow đa bước):

```
src/modules/order/
├── index.ts
├── domain/{order.entity,validators,state-machine,errors}.ts
├── infra/{orders.schema,order.repository,order-items.schema}.ts
├── features/
│   ├── create-order/       # 3-step saga
│   ├── pay-order/          # gọi PSP
│   ├── ship-order/
│   ├── cancel-order/
│   ├── refund-order/
│   ├── list-orders/
│   ├── get-order/
│   └── update-shipping-address/
├── integration-events.ts   # order.{created,paid,shipped,cancelled,refunded}
└── routes.ts
```

## Tham khảo

- Rule auto-load: `.claude/rules/module-boundary.md`
- Reference implementation: `src/modules/product/` (Vertical Slice)
- Architecture test: `scripts/check-boundaries.ts` (chạy `bun run check:boundaries`)
- Skill: `new-module` (tạo module), `new-feature` (thêm slice)
