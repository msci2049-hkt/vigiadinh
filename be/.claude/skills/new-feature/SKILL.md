---
name: new-feature
description: Thêm feature mới (1 vertical slice) vào module có sẵn dùng pattern Slice. Dùng khi user gõ "thêm feature X", "thêm chức năng X vào module Y", "tạo slice".
---

# New feature workflow (cho module Vertical Slice)

PRECONDITION: module đang dùng Vertical Slice (có folder `features/`).
Module đang Layered → đề xuất user refactor sang Slice HOẶC dùng skill `new-route` để thêm route phẳng.

## Workflow

1. **Verify module Slice**: `ls src/modules/<module>/features/` → tồn tại.
2. **Tên feature** kebab-case, action-oriented (`create-X`, `cancel-X`, `archive-X`). Hỏi user nếu chưa rõ.
3. Tạo folder `src/modules/<module>/features/<feature-name>/`.
4. Tạo 3 file:
   - `dto.ts` — Zod input/output schema
   - `handler.ts` — Hono route + business logic (≤ 200 dòng)
   - `handler.test.ts` — Test cho handler
5. Wire route vào `src/modules/<module>/routes.ts`:
   ```ts
   import { <feature>Route } from "./features/<feature-name>/handler";
   export const <module>Routes = new Hono()
     // ...
     .route("/", <feature>Route);
   ```
6. `bun run validate` — typecheck + biome + boundary check
7. Curl test endpoint:
   - No-auth → 401 (nếu cần auth)
   - Valid input → 200/201
   - Invalid input → 422
8. Update `CODE_BASE_MAP.md`

## Pattern `handler.ts`

```ts
import { Hono } from "hono";
import { eventBus } from "@/lib/events";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/<name>.repository";
import { inputSchema } from "./dto";

export const <feature>Route = new Hono().<method>(
  "<path>",
  requireAuth,
  zv("json", inputSchema),
  async (c) => {
    const input = c.req.valid("json");
    const user = c.get("user")!;
    const result = await repo.<action>(input);
    // Emit event nếu có side effect cross-module
    eventBus.emit("<name>.<action>", { /* payload */ });
    return c.json({ data: result });
  },
);
```

## Quy tắc

- 1 feature = **1 use case** (không gộp nhiều action)
- Handler self-contained — toàn bộ logic feature trong handler.ts
- ❌ KHÔNG import từ feature khác (`../<other-feature>/...`)
- ❌ KHÔNG import cross-module deep — chỉ `@/modules/<X>` qua index
- ✅ Cross-module side effect: `eventBus` (consumer `.on` PHẢI sync, no I/O) hoặc BullMQ (durable/async) — xem `.claude/rules/events.md`, enforce ở `check:boundaries`
- ✅ Dùng repo trong `infra/` để query DB
- Test handler có thể test repo + business logic (DB integration)

## Khi nào KHÔNG dùng skill này

- Module đang Layered → dùng `new-route` thay
- Cần workflow nhiều bước (Saga) → cân nhắc job BullMQ thay vì 1 feature
