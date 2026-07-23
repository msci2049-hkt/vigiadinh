# SKILL: Thêm plugin vào Better Auth

## Dùng khi nào

- Thêm OAuth provider: Google, Apple, GitHub, Facebook.
- Thêm 2FA TOTP cho admin.
- Thêm organization (multi-tenancy) cho SaaS.
- Thêm magic link, passkey, OpenAPI docs.
- **Tiền điều kiện:** Better Auth đã setup (xem skill `setup-better-auth`).

---

## Thứ tự làm

```
1. Đọc src/lib/auth.ts xem plugin đã có.

2. Nếu thêm passkey: cài package riêng
   bun add @better-auth/passkey

3. Sửa src/lib/auth.ts:
   - Import plugin từ "better-auth/plugins" (hoặc "@better-auth/passkey").
   - Thêm vào mảng plugins: [...].
   - Cấu hình env nếu cần (OAuth client ID/secret, rpID, v.v.).

4. Thêm env vars vào src/env.ts (qua @t3-oss/env-core).

5. Sinh lại schema:
   bun run auth:generate

6. Sinh + apply migration:
   bun run db:generate
   bun run db:migrate

7. Curl test endpoint mới (vd: /api/auth/sign-in/social?provider=google).

8. Cập nhật .claude/CODE_BASE_MAP.md (nếu thêm bảng mới qua plugin).
```

---

## File chỉnh sửa

- `src/lib/auth.ts`
- `src/env.ts`
- `src/db/schema/auth.ts` (CLI sinh lại, KHÔNG sửa tay)
- `drizzle/<timestamp>_*.sql` (auto)

---

## Code mẫu

### Google OAuth

```ts
// src/lib/auth.ts
export const auth = betterAuth({
  // ...
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // redirectURI mặc định: ${baseURL}/api/auth/callback/google
    },
  },
});
```

```env
# .env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

```ts
// src/env.ts (thêm)
GOOGLE_CLIENT_ID: z.string().min(1),
GOOGLE_CLIENT_SECRET: z.string().min(1),
```

### Apple OAuth

```ts
socialProviders: {
  apple: {
    clientId: env.APPLE_CLIENT_ID,
    clientSecret: env.APPLE_CLIENT_SECRET, // JWT signed với private key
  },
},
```

### 2FA TOTP (cho admin)

```ts
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  // ...
  plugins: [
    twoFactor({
      issuer: env.APP_NAME, // hiển thị trong Google Authenticator
    }),
  ],
});
```

Endpoint sinh ra: `/api/auth/two-factor/enable`, `/two-factor/verify`, etc.

### Organization (multi-tenancy)

```ts
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  // ...
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,
    }),
  ],
});
```

Bảng mới: `organization`, `member`, `invitation`. Endpoint: `/api/auth/organization/create`, etc.

### Magic Link

```ts
import { magicLink } from "better-auth/plugins";
import { sendMagicLinkEmail } from "@/services/email/send-magic-link";

export const auth = betterAuth({
  // ...
  plugins: [
    magicLink({
      // Note: Better Auth 1.4+ truyền ctx thay cho request.
      sendMagicLink: async ({ email, url }, ctx) => {
        await sendMagicLinkEmail({
          to: email,
          url,
          ip: ctx.request?.headers.get("x-forwarded-for") ?? null,
        });
      },
      expiresIn: 60 * 5, // 5 phút
    }),
  ],
});
```

### Passkey (package RIÊNG kể từ 1.4)

```ts
// QUAN TRỌNG: passkey không nằm trong "better-auth/plugins" nữa.
// Phải cài: bun add @better-auth/passkey
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  // ...
  plugins: [
    passkey({
      rpID: env.PASSKEY_RP_ID,         // "myapp.com" — KHÔNG có scheme/port
      rpName: env.APP_NAME,
      origin: env.BETTER_AUTH_URL,      // "https://myapp.com" — CÓ scheme
    }),
  ],
});
```

### OpenAPI docs

```ts
import { openAPI } from "better-auth/plugins";

export const auth = betterAuth({
  // ...
  plugins: [openAPI()],
});
```

→ Mở `/api/auth/reference` thấy Scalar UI.

### Kết hợp nhiều plugin

```ts
import { twoFactor, organization, magicLink, openAPI } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  // ...
  socialProviders: {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  plugins: [
    organization({ allowUserToCreateOrganization: true, organizationLimit: 5 }),
    twoFactor({ issuer: env.APP_NAME }),
    magicLink({ sendMagicLink: async ({ email, url }) => { /* ... */ } }),
    passkey({ rpID: env.PASSKEY_RP_ID, rpName: env.APP_NAME, origin: env.BETTER_AUTH_URL }),
    openAPI(),
  ],
});
```

---

## Curl test

```bash
# Google OAuth — chuyển hướng đến Google
curl -i "http://localhost:3000/api/auth/sign-in/social?provider=google"
# → 302 Location: https://accounts.google.com/...

# Magic link request
curl -i -X POST http://localhost:3000/api/auth/sign-in/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# → 200 (email được gửi qua sendMagicLink callback)

# 2FA enable (cần login trước)
curl -i -X POST http://localhost:3000/api/auth/two-factor/enable \
  -H "Content-Type: application/json" \
  -b cookie.txt \
  -d '{"password":"abcdefgh"}'

# OpenAPI docs
open http://localhost:3000/api/auth/reference
```

---

## Checklist cuối

- [ ] Plugin import từ ĐÚNG package (passkey từ `@better-auth/passkey`).
- [ ] Env vars cần thiết đã thêm vào `src/env.ts` + `.env.example`.
- [ ] `bun run auth:generate` thành công.
- [ ] Migration đã apply, bảng mới (vd: `organization`) đã tạo.
- [ ] Curl test endpoint mới thành công.
- [ ] OAuth: redirect đến provider đúng (kiểm tra Location header).
- [ ] Cập nhật `.claude/CODE_BASE_MAP.md` cho bảng mới.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `Cannot find module 'better-auth/plugins/passkey'` | Passkey đã tách ra v1.4 | `bun add @better-auth/passkey` + đổi import. |
| OAuth callback báo `Invalid redirect URI` | Chưa whitelist URL ở Google Console | Thêm `${baseURL}/api/auth/callback/google`. |
| Passkey: `Invalid origin` | `rpID` có scheme/port, hoặc `origin` thiếu scheme | `rpID="myapp.com"`, `origin="https://myapp.com"`. |
| 2FA TOTP luôn fail | Server lệch giờ với authenticator app | NTP-sync server: `timedatectl status`. |
| Magic link không gửi | `sendMagicLink` callback throw silent | Wrap try/catch, log error qua pino. |
| Organization plugin: user mới không có active org | Quên set `activeOrganizationId` sau create | Set ngay sau `organization.create` API. |
| Generate CLI báo lỗi `auth file not found` | Path sai trong script | `--config src/lib/auth.ts` từ root project. |
| Plugin thêm rồi mà bảng không sinh | Quên chạy `auth:generate` trước `db:generate` | Thứ tự: auth:generate → db:generate → db:migrate. |
| `experimental.joins` báo lỗi | Drizzle schema chưa định nghĩa relations | Định nghĩa relations qua `relations()` của drizzle. |
