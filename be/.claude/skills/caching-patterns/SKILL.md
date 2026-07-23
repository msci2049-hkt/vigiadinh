---
name: caching-patterns
description: Thêm cache đọc trên Dragonfly đúng cách cho template BE — cache-aside (đọc miss→DB→set), invalidation khi write, chống cache stampede (lock/jitter TTL), key versioning, và luật TIỀN không bao giờ cache stale. Dùng khi user gõ "thêm cache", "cache query", "Redis cache", "giảm tải DB", "cache-aside", "invalidate cache", "cache hết hạn cùng lúc / stampede", "cache-hit thấp", "dữ liệu cũ sau khi sửa". Đọc TRƯỚC khi tự nhét giá trị vào Dragonfly làm cache — sai invalidation là nguồn bug "data cũ" khó chịu nhất.
---

# Caching trên Dragonfly: cache-aside đúng

> ⚠️ **Template CHƯA có cache helper** (chỉ có `rateLimitConnection`/`bullConnection` cho rate-limit + queue, và
> Better Auth `secondaryStorage`). Thêm cache = viết mới. Skill này là *quyết định + pattern chuẩn*, không phải
> wrapper có sẵn. Nguồn sự thật vẫn là **Postgres** (skill `postgres-drizzle-data`); cache chỉ tăng tốc đọc.

## Khi nào cache (và khi nào KHÔNG)

- Cache khi: đọc nhiều, đổi ít, chịu được stale ngắn (danh sách công khai, config, thống kê).
- **KHÔNG cache**: **TIỀN / số dư / trạng thái đơn vừa đổi** (đọc stale → quyết định sai). Đọc primary trực tiếp.
  Dữ liệu per-tenant → key phải chứa scope (đừng để tenant A đọc cache tenant B).

## Cache-aside (pattern chuẩn)

```ts
// Nếu thêm cache: dựng 1 ioredis RIÊNG theo mẫu src/lib/redis.ts (enableOfflineQueue:false → cache down thì
// fail-fast, đọc rơi về DB — KHÔNG treo request). ĐỪNG tái dùng bullConnection (maxRetriesPerRequest:null → treo).
async function getUserCard(id: string) {
  const key = `cache:user-card:v1:${id}`;
  const hit = await cacheRedis.get(key).catch(() => null);   // lỗi cache → coi như miss (fail-open ĐỌC)
  if (hit) return JSON.parse(hit);
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (row) await cacheRedis.set(key, JSON.stringify(row), "EX", 60).catch(() => {}); // TTL + jitter (dưới)
  return row;
}
```

## Invalidation — khi WRITE, xoá/ghi lại key

Cache-aside sống/chết ở invalidation. Khi update entity → `del(key)` (hoặc set giá trị mới) **trong cùng luồng
ghi**. Không invalidate = "data cũ" sau khi sửa. Cross-process: `del` trên Dragonfly là shared → mọi web instance
thấy (khác Map in-RAM — xem `cluster-stateless`). Có thể dùng `eventBus.on("x.updated", e => cache.del(...))`
(sync, no-I/O-khác — nhưng `.del` là I/O redis; đặt invalidate ở chính handler ghi thì sạch hơn — rule events.md).

## Chống stampede (cache miss đồng loạt)

- **Jitter TTL**: TTL = base ± random (vd `60 + rand(0..15)`) → key không hết hạn cùng lúc → không dồn DB.
- **Lock tái tính**: key hot → 1 request giữ lock (SET NX EX ngắn) tính lại, các request khác đợi/đọc stale ngắn.
  Redis SET NX là lock efficiency (chấp nhận), KHÔNG dùng cho correctness (tiền → DB lock).
- **Key versioning** (`:v1:`): đổi schema giá trị cache → bump `v2` thay vì đi xoá từng key (bản cũ tự hết hạn).

## GOTCHAS

- **Cache dùng `bullConnection`** (maxRetriesPerRequest:null) → khi Dragonfly chậm, `get` **treo request**. Cache
  phải dùng connection `enableOfflineQueue:false` (fail-fast → rơi về DB).
- **Cache TIỀN stale** → hiển thị/duyệt sai số. Luật: money reads primary, no cache (nối `scaling-playbook` replica).
- **Quên invalidate khi write** = bug "sửa xong vẫn thấy cũ" — nguồn lỗi cache số 1. Invalidate ở luồng ghi.
- **Key không chứa scope/tenant** → rò dữ liệu chéo. Đưa mọi yếu tố phân biệt vào key.
- **`JSON.parse` giá trị cache tin mù** → giá trị hỏng/format cũ làm throw. Guard parse (try/catch → miss).

## Cross-reference

`cluster-stateless` (state qua Dragonfly, không RAM) · `postgres-drizzle-data` (nguồn sự thật, index trước khi cache) ·
`scaling-playbook` (cache-hit đo, replica) · `.claude/rules/events.md` (invalidate qua eventBus) · `bullmq-jobs`.
