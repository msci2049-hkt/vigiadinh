# SKILL: Bảo vệ route bằng auth/role/org/ownership

## Dùng khi nào

- Route cần authenticated user.
- RBAC (admin/user) cho route admin.
- Multi-tenant: route gắn với 1 organization.
- Ownership: user chỉ sửa resource của mình.

---

## Thứ tự làm

```
1. Đảm bảo Better Auth đã setup (skill setup-better-auth).
2. Đảm bảo src/types/hono.d.ts có augmentation.
3. Tạo src/middlewares/auth.ts với các factory:
   - requireAuth
   - requireRole(...roles)
   - requireOrg
   - assertOwnership(resource, userId) (helper, KHÔNG phải middleware)
4. Áp dụng theo thứ tự trong route:
   requireAuth → requireRole → requireOrg → handler.
5. Ownership check NẰM TRONG handler (cần load resource trước).
6. Curl test các edge case: no-auth, wrong-role, wrong-org, wrong-owner.
```

---

## File tạo ở đâu

- `src/middlewares/auth.ts`
- `src/types/hono.d.ts` (đã có từ setup-better-auth)

---

## Code mẫu

### 1. `src/middlewares/auth.ts`

```ts
/**
 * Auth middleware factories.
 *
 * Quy tắc:
 * - Throw HTTPException để global onError map sang JSON.
 * - KHÔNG return c.json(..., 401) từ middleware — bypass error handler
 *   + bỏ qua observability hook.
 * - Service KHÔNG biết HTTP status. Middleware ở đây mới biết.
 */
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "@/lib/logger";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!c.get("user")) {
    throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  }
  await next();
};

type Role = "admin" | "user";

export const requireRole = (...allowed: Role[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const role = (user as unknown as { role?: Role }).role ?? "user";
    if (!allowed.includes(role)) {
      logger.warn({ userId: user.id, role, allowed }, "rbac.denied");
      throw new HTTPException(403, { message: "FORBIDDEN_ROLE" });
    }
    await next();
  };
};

export const requireOrg: MiddlewareHandler = async (c, next) => {
  const session = c.get("session");
  const orgId = (session as unknown as { activeOrganizationId?: string })?.activeOrganizationId;
  if (!orgId) throw new HTTPException(403, { message: "NO_ACTIVE_ORG" });
  c.set("activeOrgId", orgId);
  await next();
};

/**
 * Ownership check — KHÔNG phải middleware vì cần resource đã load.
 * Gọi trong handler sau khi getById.
 */
export function assertOwnership(
  resource: { ownerId?: string | null; userId?: string | null },
  userId: string,
): void {
  const ownerId = resource.ownerId ?? resource.userId;
  if (ownerId !== userId) {
    throw new HTTPException(403, { message: "NOT_OWNER" });
  }
}
```

### 2. Áp dụng trong route — ví dụ module `posts`

```ts
// src/modules/post/routes.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth, requireRole, assertOwnership } from "@/middlewares/auth";
// WHY dùng `zv` thay `zValidator`: short-circuit + shape lệch global onError
// (xem .claude/ERRORS.md BUG-001).
import { zv } from "@/middlewares/validator";
import * as postService from "./service";
import { postIdParam, updatePostDto } from "./dto";

export const postRoutes = new Hono()
  // Public: ai cũng đọc được.
  .get("/", async (c) => c.json({ data: await postService.listPublic() }))

  // Authenticated: cần login.
  .get("/me", requireAuth, async (c) =>
    c.json({ data: await postService.listByUser(c.get("user")!.id) }))

  // Admin only.
  .get("/admin/all", requireAuth, requireRole("admin"), async (c) =>
    c.json({ data: await postService.listAll() }))

  // Owner only: PATCH bài viết của mình.
  .patch("/:id",
    requireAuth,
    zv("param", postIdParam),
    zv("json", updatePostDto),
    async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      const post = await postService.getById(id);
      if (!post) throw new HTTPException(404, { message: "POST_NOT_FOUND" });
      assertOwnership(post, user.id); // throw 403 nếu không phải chủ.

      return c.json({ data: await postService.update(id, input) });
    });
```

### 3. Multi-tenant: route gắn organization

```ts
// src/modules/team/routes.ts
import { Hono } from "hono";
import { requireAuth, requireOrg } from "@/middlewares/auth";
import * as teamService from "./service";

export const teamRoutes = new Hono()
  .use("*", requireAuth, requireOrg)
  .get("/members", async (c) => {
    const orgId = c.get("activeOrgId")!;
    return c.json({ data: await teamService.listMembers(orgId) });
  });
```

### 4. Kết hợp role + ownership

```ts
.delete("/:id",
  requireAuth,
  zv("param", postIdParam),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const post = await postService.getById(id);
    if (!post) throw new HTTPException(404, { message: "POST_NOT_FOUND" });

    // Admin được xoá bài của bất kỳ ai. User thường chỉ xoá bài mình.
    const role = (user as unknown as { role?: string }).role ?? "user";
    if (role !== "admin") assertOwnership(post, user.id);

    await postService.delete(id);
    return c.body(null, 204);
  });
```

---

## Pattern bắt buộc

### Thứ tự middleware
```
zv (param/query/json) → requireAuth → requireRole → requireOrg → handler
```
- Validate trước → fail-fast trên input xấu (rẻ hơn check session).
- Auth trước role: chưa login thì không cần check role.

### KHÔNG dùng các pattern này

```ts
// ❌ SAI: return c.json từ middleware
async (c, next) => {
  if (!c.get("user")) return c.json({ error: "..." }, 401);
};

// ❌ SAI: kiểm tra ownership trong middleware (chưa có resource)
const requireOwnership = async (c, next) => { /* không khả thi */ };

// ❌ SAI: service throw HTTPException
// Service throw domain string, route map HTTP.
```

---

## Curl test (BẮT BUỘC)

```bash
# 1. No auth → 401
curl -i http://localhost:3000/api/posts/me
# HTTP/1.1 401

# 2. User role gọi admin route → 403 FORBIDDEN_ROLE
curl -i http://localhost:3000/api/posts/admin/all -b cookie-user.txt
# HTTP/1.1 403

# 3. Wrong owner → 403 NOT_OWNER
curl -i -X PATCH http://localhost:3000/api/posts/<id-người-khác> \
  -b cookie-user.txt -H "Content-Type: application/json" \
  -d '{"title":"hijack"}'
# HTTP/1.1 403

# 4. No active org → 403 NO_ACTIVE_ORG
curl -i http://localhost:3000/api/team/members -b cookie-no-org.txt
# HTTP/1.1 403

# 5. Happy path
curl -i http://localhost:3000/api/posts/me -b cookie-user.txt
# HTTP/1.1 200
```

---

## Checklist cuối

- [ ] `src/middlewares/auth.ts` có 3 middleware + 1 helper.
- [ ] Throw `HTTPException`, KHÔNG `return c.json` trong middleware.
- [ ] Thứ tự áp dụng: zv → requireAuth → requireRole → requireOrg → handler.
- [ ] Dùng `zv` từ `@/middlewares/validator`, KHÔNG `zValidator` trực tiếp (BUG-001).
- [ ] Ownership check nằm trong handler.
- [ ] Curl test đủ 5 case: no-auth, wrong-role, wrong-owner, no-org, happy.
- [ ] File ≤ 300 dòng.
- [ ] Comment giải thích vì sao middleware throw thay vì return.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `c.get("user")` type là `unknown` | Thiếu module augmentation | Tạo `src/types/hono.d.ts` + include trong `tsconfig.json`. |
| 401 dù đã login | Session middleware mount sau routes | Mount session populate ở `src/app.ts` TRƯỚC routes. |
| Bearer token bị ignore | `auth.api.getSession` chỉ đọc cookie | Thêm plugin `bearer()` vào Better Auth. |
| 403 NO_ACTIVE_ORG cho user mới create | Chưa set active org | Set `activeOrganizationId` ngay sau `organization.create`. |
| HTTPException không hiển thị message | Hono mặc định trả empty body | Setup global `onError` (xem skill error-handler). |
| RequireRole pass cho admin chính xác nhưng deny user khác | `role` field không tồn tại trên user schema | Thêm field `role` qua Better Auth `user.additionalFields`. |
| Ownership check nhầm field | `userId` vs `ownerId` không match | Helper `assertOwnership` đã fallback cả 2 field. |
