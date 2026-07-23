---
name: add-2fa
description: Thêm Two-Factor Authentication (TOTP) vào Better Auth. Dùng khi user gõ "thêm 2FA", "2 factor", "xác thực 2 lớp".
---

# Add 2FA (TOTP) workflow

PRECONDITION: Better Auth production-grade đã setup.

## Bước 1 — Cài plugin

Plugin `twoFactor` đã có trong `better-auth/plugins` — KHÔNG cần `bun add` thêm.

## Bước 2 — Update `src/lib/auth.ts`

```ts
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  // ... config khác
  plugins: [
    twoFactor({
      issuer: env.APP_NAME ?? "MyApp",
      totpOptions: {
        period: 30,
        digits: 6,
      },
    }),
  ],
});
```

## Bước 3 — Order BẮT BUỘC (rule auth.md)

```bash
bun run auth:generate   # sinh schema mới (twoFactor table)
bun run db:generate     # sinh migration SQL
# ĐỌC drizzle/<ts>_*.sql — chắc chắn không DROP COLUMN
bun run db:migrate      # apply
```

## Bước 4 — Test enroll TOTP

```bash
# 1. Sign-in
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" -c /tmp/cookies.txt \
  -d '{"email":"...","password":"..."}'

# 2. Enable 2FA → trả secret + QR
curl -X POST http://localhost:3000/api/auth/two-factor/enable -b /tmp/cookies.txt

# 3. Verify code (từ Authenticator app)
curl -X POST http://localhost:3000/api/auth/two-factor/verify-totp \
  -b /tmp/cookies.txt -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

## Bước 5 — Frontend integration

`authClient.twoFactor.enable()` / `.verifyTotp({ code })`.

## Verify

- [ ] Schema mới có `twoFactor` table sau migrate
- [ ] Enroll trả `qrCode` + `secret`
- [ ] Verify code đúng → response success
- [ ] Recovery code lưu ở user (download for backup)
