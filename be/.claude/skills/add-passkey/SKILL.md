---
name: add-passkey
description: Thêm Passkey (WebAuthn) authentication vào Better Auth. Dùng khi user gõ "thêm passkey", "WebAuthn", "passwordless".
---

# Add Passkey (WebAuthn) workflow

PRECONDITION: Better Auth production-grade đã setup.

## Bước 1 — Cài plugin riêng (Better Auth v1.4+ tách package)

```bash
bun add @better-auth/passkey
```

⚠️ KHÔNG import từ `better-auth/plugins/passkey` (deprecated v1.4 — xem `.claude/rules/auth.md`).

## Bước 2 — Update `src/lib/auth.ts`

```ts
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  // ...
  plugins: [
    passkey({
      rpID: isProd ? "yourdomain.com" : "localhost",
      rpName: "Your App Name",
      origin: env.BETTER_AUTH_URL,
    }),
  ],
});
```

## Bước 3 — Order BẮT BUỘC (rule auth.md)

```bash
bun run auth:generate   # sinh bảng passkey
bun run db:generate
# ĐỌC SQL — không DROP COLUMN
bun run db:migrate
```

## Bước 4 — Test register passkey (frontend)

```ts
const options = await authClient.passkey.register({ name: "My device" });
// browser sẽ prompt Touch ID / Windows Hello
```

## Bước 5 — Test sign-in passkey

```ts
const result = await authClient.signIn.passkey();
```

## Quy tắc production

- `rpID` = domain CHÍNH XÁC (không có protocol, không port). Vd `app.example.com`.
- `origin` = full URL with protocol. Phải khớp với `Origin` header.
- HTTPS bắt buộc trên production. Localhost được exempt.
- User có thể đăng ký nhiều passkey (1 cho điện thoại, 1 cho laptop).

## Verify

- [ ] Bảng `passkey` có sau migrate
- [ ] Register flow trả `id` của passkey mới
- [ ] Sign-in passkey thành công, set session cookie
- [ ] Test trên iOS Safari + Chrome Android (passkey sync)
