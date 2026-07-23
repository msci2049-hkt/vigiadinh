---
description: Module boundary và cross-module communication. Auto-load khi sửa src/modules/**.
globs:
  - "src/modules/**"
---

# Module Boundary Rules

## Decision Tree — Layered vs Vertical Slice

Khi tạo module mới, CHỌN pattern theo SỐ ENDPOINT:

| Module có | Pattern |
|---|---|
| < 5 endpoint | **Layered** (đơn giản) |
| ≥ 5 endpoint | **Vertical Slice** (tách feature) |

Nếu không rõ → HỎI user trước khi code.

### Layered structure (module nhỏ)

```
src/modules/<name>/
├── types.ts
├── dto.ts
├── service.ts          # ≤ 300 dòng
├── routes.ts
└── service.test.ts
```

### Vertical Slice structure (module to)

```
src/modules/<name>/
├── index.ts                    # Public facade
├── domain/
│   ├── <name>.entity.ts
│   ├── validators.ts
│   └── errors.ts
├── infra/
│   ├── <name>.schema.ts
│   └── <name>.repository.ts
├── features/
│   └── <feature-name>/
│       ├── dto.ts
│       ├── handler.ts
│       └── handler.test.ts
├── integration-events.ts
└── routes.ts
```

## Upgrade Layered → Slice khi:

1. `service.ts` > 250 dòng (cảnh báo), > 300 dòng (BẮT BUỘC)
2. Module sắp thêm endpoint thứ 5
3. Feature mới có workflow phức tạp (≥ 3 bước)

## Public Facade (cho cả 2 pattern)

Module CHỈ export ra ngoài qua `index.ts` (slice) hoặc named exports trong `service.ts` (layered):

- Types (`Product`, `Order`)
- Integration events
- 1-2 helper function public (hạn chế)

CẤM export:

- Internal handler (`features/X/handler.ts`)
- Schema infra (`infra/X.schema.ts`)
- Domain entity nội bộ

## Cross-module communication — CHỈ 3 cách

### Cách 1: Domain Event qua `eventBus` (sync, in-memory)

```ts
// Module A
import { eventBus } from "@/lib/events";
eventBus.emit("order.created", { orderId, items });

// Module B subscribe init phase — handler PHẢI sync (no async/await/I/O)
eventBus.on("order.created", (e) => { /* sync side-effect; I/O/durable → BullMQ */ });
```

> Handler `eventBus.on` chỉ side-effect **sync cùng-request**; I/O/durable đi BullMQ (Cách 2). Luật + gap + enforce: `.claude/rules/events.md`.

### Cách 2: Integration Event qua BullMQ (async, retry)

```ts
import { stockQueue } from "@/jobs/queues";
await stockQueue.add("reduce-stock", { orderId });
```

### Cách 3: Public Facade Import (sync, hạn chế)

```ts
import { type Product } from "@/modules/product";
```

## CẤM tuyệt đối

```ts
// ❌ Deep import features
import { handler } from "@/modules/product/features/create-product/handler";

// ❌ Import infra
import { products } from "@/modules/product/infra/products.schema";

// ❌ Import domain entity nội bộ
import { Product } from "@/modules/product/domain/product.entity";
```

Tất cả phải qua `@/modules/product` (index.ts).

## DRY trong module

- File "trùng tên" (`dto.ts`, `handler.ts`) là CONVENTION, không phải duplicate
- Logic THẬT SỰ lặp lại ≥ 3 lần → tách vào:
  - `domain/<entity>.ts` — business logic shared
  - `domain/validators.ts` — Zod field reusable
  - `infra/<name>.repository.ts` — DB query shared
- **Rule of Three**: đợi lần thứ 3 mới tách, không premature abstraction

## Enforcement tự động

- `bun run check:boundaries` chạy trong `bun run validate` (typecheck + biome + boundary).
- Vi phạm → CI fail, không merge được.

## Khi sửa file ở đây, MUST verify

- [ ] Module mới có file `index.ts` (slice) HOẶC `service.ts` (layered).
- [ ] KHÔNG có `import` cross-module deep (chỉ `@/modules/<name>`).
- [ ] Schema move vào `infra/` đã re-export trong `src/db/schema/index.ts`.
- [ ] Cross-module side-effect → eventBus hoặc BullMQ.
- [ ] `bun run check:boundaries` PASS.
