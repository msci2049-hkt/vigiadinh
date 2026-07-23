# SKILL: Setup Better Auth (1 lần lúc init project)

## Dùng khi nào

- Khởi tạo project mới, lần đầu setup auth.
- Sau khi cài `better-auth` lần đầu vào project có sẵn.
- **Skill này chỉ chạy 1 lần.** Thêm plugin sau đó → dùng `add-auth-plugin`.

---

## Thứ tự làm

```
1. Cài deps:
   bun add better-auth
   bun add -D @better-auth/cli

2. Sinh secret:
   openssl rand -base64 32
   → Lưu vào .env làm BETTER_AUTH_SECRET.

3. Thêm env vào src/env.ts (xem skill new-env-var):
   BETTER_AUTH_SECRET, BETTER_AUTH_URL, TRUSTED_ORIGINS.

4. Tạo src/lib/auth.ts với betterAuth() + drizzleAdapter.

5. Chạy CLI sinh schema:
   bunx @better-auth/cli@latest generate \
     --config src/lib/auth.ts \
     --output src/db/schema/auth.ts

6. Re-export trong src/db/schema/index.ts:
   export * from "./auth";

7. Sinh + apply migration:
   bun run db:generate
   bun run db:migrate

8. Mount handler trong src/app.ts ĐÚNG THỨ TỰ:
   CORS → auth.handler → session middleware → routes

9. Curl test:
   curl -X POST http://localhost:3000/api/auth/sign-up/email ...
```

---

## File tạo ở đâu

- `src/lib/auth.ts` — single source of truth.
- `src/db/schema/auth.ts` — CLI generated, **KHÔNG sửa tay**.
- `src/types/hono.d.ts` — type augment `c.get("user")/c.get("session")`.
- `src/app.ts` — mount handler + session middleware.

---

## Code mẫu

### 1. `src/lib/auth.ts`

```ts
/**
 * Better Auth instance — single source of truth.
 * - Sau khi sửa file này: bun run auth:generate && bun run db:migrate
 * - Plugin order không ảnh hưởng runtime nhưng giữ stable cho diff sạch.
 * - secret KHÔNG bao giờ hardcode — luôn qua @/env.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.TRUSTED_ORIGINS.split(","),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // bật khi đã có flow send email
    autoSignIn: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 ngày
    updateAge: 60 * 60 * 24,       // refresh mỗi ngày
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  // Plugin thêm dần qua skill add-auth-plugin.
  plugins: [],
});

export type Session = typeof auth.$Infer.Session;
```

### 2. `src/db/schema/auth.ts` (CLI generated)

CLI sẽ sinh các bảng: `user`, `session`, `account`, `verification`. KHÔNG sửa tay file này. Nếu cần thêm field → sửa `auth.ts` rồi chạy lại CLI.

### 3. `src/types/hono.d.ts`

```ts
/**
 * Module augmentation để c.get("user") và c.get("session") typed
 * khắp nơi, không cần redeclare Variables ở mỗi Hono instance.
 */
import type { auth } from "@/lib/auth";

type S = typeof auth.$Infer.Session;

declare module "hono" {
  interface ContextVariableMap {
    user: S["user"] | null;
    session: S["session"] | null;
    activeOrgId: string | null;
    rawBody: string;
  }
}
```

### 4. `src/app.ts` — mount theo thứ tự ĐÚNG

```ts
/**
 * Hono app setup. Thứ tự middleware QUAN TRỌNG:
 *   1) CORS (cookie cần credentials: true)
 *   2) Better Auth handler — TRƯỚC mọi guard
 *   3) Session populate middleware
 *   4) Routes nghiệp vụ
 *
 * Đặt auth.handler SAU session middleware → sign-in 404/401.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@/lib/auth";
import { env } from "@/env";

export const app = new Hono();

// 1) CORS — credentials: true bắt buộc cho cookie auth.
app.use("*", cors({
  origin: env.TRUSTED_ORIGINS.split(","),
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// 2) Mount Better Auth handler ngay sau CORS.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 3) Populate c.var.user và c.var.session cho mọi request.
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});

// 4) Routes nghiệp vụ mount sau (ở src/index.ts hoặc tại đây).
```

### 5. `package.json` script

```json
{
  "scripts": {
    "auth:generate": "bunx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/db/schema/auth.ts"
  }
}
```

### 6. `.env`

```env
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 7. `src/env.ts` (thêm vars)

```ts
// Thêm vào schema của @t3-oss/env-core:
BETTER_AUTH_SECRET: z.string().min(32),
BETTER_AUTH_URL: z.string().url(),
TRUSTED_ORIGINS: z.string().min(1),
```

---

## Curl test (BẮT BUỘC)

```bash
# Get session (chưa login) → 200 với { user: null, session: null }
curl -i http://localhost:3000/api/auth/get-session

# Sign up
curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"abcdefgh","name":"Test"}'

# Sign in
curl -i -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookie.txt \
  -d '{"email":"test@example.com","password":"abcdefgh"}'

# Get session với cookie
curl -i http://localhost:3000/api/auth/get-session -b cookie.txt
```

---

## Checklist cuối

- [ ] `src/lib/auth.ts` tạo, secret qua `@/env`.
- [ ] CLI generate đã chạy → `src/db/schema/auth.ts` tồn tại.
- [ ] Re-export trong `src/db/schema/index.ts`.
- [ ] Migration apply thành công (bảng `user`, `session`, `account`, `verification`).
- [ ] `src/types/hono.d.ts` có module augmentation.
- [ ] `src/app.ts` mount theo thứ tự: CORS → auth.handler → session → routes.
- [ ] Sign-up + sign-in qua curl thành công.
- [ ] `/api/auth/get-session` với cookie trả `{ user, session }`.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| Sign-in trả 404 | Quên mount `auth.handler` hoặc mount sau session middleware | Mount ngay sau CORS. |
| `getSession` luôn trả null | CORS thiếu `credentials: true` hoặc client không gửi `credentials: "include"` | Cập nhật cả 2 phía. |
| `Cannot read property '$Infer' of undefined` | Import sai từ `better-auth/types` | Import từ instance `auth` ở `@/lib/auth`. |
| Migration báo bảng `user` đã tồn tại | DB cũ có bảng cùng tên | Drop bảng cũ hoặc đổi `tablePrefix` ở better-auth. |
| Type `c.get("user")` báo `unknown` | Thiếu `src/types/hono.d.ts` | Tạo file + thêm `include` trong `tsconfig.json`. |
| Cookie không lưu trên browser | `secure: true` ở localhost (HTTP) | Better Auth tự handle. Nếu lỗi, set `SECURE_COOKIE=false` ở dev env. |
| `BETTER_AUTH_SECRET` báo too short | Secret < 32 ký tự | `openssl rand -base64 32` (44 ký tự). |
| CLI generate báo lỗi `Cannot find auth` | Path config sai | `--config src/lib/auth.ts` đúng tuyệt đối từ root project. |
