---
globs: src/lib/events.ts,src/modules/**/integration-events.ts,src/**/*subscriber*.ts,src/**/*subscribers*.ts
description: eventBus = sync in-process only; I/O/durable đi BullMQ. Auto-load khi đụng events/subscriber.
---

# Rule: eventBus (domain event in-process)

Áp dụng khi đụng `src/lib/events.ts`, `*/integration-events.ts`, hoặc file đăng ký `eventBus.on(...)`.

## eventBus là gì

- Type-safe `EventEmitter` singleton (`src/lib/events.ts`), **in-memory, cùng-process, đồng bộ**.
- Mục đích: cross-module side-effect **sync cùng-request** — tránh deep-import handler giữa module.
- `emit` ở module A, `on` ở module B (subscribe lúc init). Contract khai báo qua
  `declare module "@/lib/events"` trong `<module>/integration-events.ts`.

## Luật: `eventBus.on` PHẢI sync, KHÔNG I/O

```ts
// ✅ — sync, cùng-request: cập nhật cache in-process, đẩy metric, invalidate ...
eventBus.on("product.created", (e) => {
  cache.delete(e.productId);
});

// ❌ — async handler / await: I/O lẫn vào event path đồng bộ
eventBus.on("product.created", async (e) => {
  await sendEmail(...);          // block emit; lỗi → nuốt mất (EventEmitter)
});

// ❌ — handler làm I/O durable (email, gọi API, ghi DB ngoài request)
eventBus.on("order.paid", (e) => {
  void resend.emails.send(...);  // không retry, mất nếu process chết
});
```

**Vì sao:**

- `emit` đồng bộ → handler chậm làm chậm cả request đang emit.
- Lỗi trong handler async **không** được caller bắt → side-effect mất âm thầm.
- Không có retry/persist → process crash giữa chừng = mất việc.

## Cần durable/async → BullMQ

I/O/việc-có-thể-fail (email, gọi API ngoài, ghi DB nền, render) → **enqueue BullMQ**, không nhét vào `eventBus.on`:

- Producer enqueue ở chính handler nghiệp vụ (cùng-request), hoặc
- Integration event qua queue (xem `.claude/rules/bullmq.md` + `module-boundary.md` Cách 2).

→ Có retry, backoff, idempotency, observability. eventBus KHÔNG có.

> Lưu ý: chữ ký `.on` trong `events.ts` vẫn nhận `Promise<void>` (kế thừa `EventEmitter`) — **đừng coi đó là cho phép async**. Guard dưới đây mới là luật.

## Enforce (đã bật)

`bun run check:boundaries` (chạy trong `bun run validate` + pre-commit) FAIL nếu `eventBus.on`:

- callback `async`, hoặc body chứa `await`;
- file đăng ký import I/O: `@/lib/{email,resend,redis,storage}`, `resend/nodemailer/ofetch/bullmq`, `@/jobs/*`, `fetch(`, hoặc `.insert/.update/.delete`.

### GAP đã biết — đây là smell-detector, KHÔNG phải proof

- Handler là **hàm async tham chiếu nơi khác** (`eventBus.on("x", asyncFn)`) → string-scan không thấy `await` ⇒ **lọt**.
- **I/O đồng bộ** (`Bun.spawnSync`, `fs.*Sync`, driver sync) ⇒ **không bị bắt**.
- I/O check ở mức **file**: file có `eventBus.on` mà import I/O bị FAIL dù import chỉ dùng ngoài handler → đăng ký `.on` ở **file subscriber riêng**, không import I/O trong đó.
- `eventBus.once()` (nếu expose) KHÔNG được quét — cùng luật sync-only áp dụng.
- Tự giác giữ handler sync — guard chỉ chặn lỗi rõ ràng.

## Khi sửa file ở đây, MUST verify

- [ ] `eventBus.on` handler **không** `async`, **không** `await`.
- [ ] File đăng ký handler **không** import I/O (email/resend/redis/storage/bullmq/jobs/fetch/db-write).
- [ ] Việc durable đã đẩy BullMQ, không nằm trong handler.
- [ ] `bun run check:boundaries` PASS.
