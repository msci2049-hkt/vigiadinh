---
name: add-oauth
description: Thêm OAuth provider (Google, GitHub, Apple, Facebook) vào Better Auth. Dùng khi user gõ "thêm Google login", "OAuth Google", "đăng nhập Facebook", "social login".
---

# Add OAuth Provider workflow

PRECONDITION: Better Auth production-grade đã setup (cookie cache + rate limit + email verify).

## Bước 1 — Lấy credentials từ provider

### Google
1. https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Authorized redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`
4. Copy `CLIENT_ID` + `CLIENT_SECRET`

### GitHub
1. https://github.com/settings/developers
2. New OAuth App
3. Callback URL: `{BETTER_AUTH_URL}/api/auth/callback/github`

### Apple / Facebook / Microsoft — tương tự (xem docs Better Auth).

## Bước 2 — Add env vars vào `.env` + `.env.example`

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## Bước 3 — Update `src/env.ts` schema

```ts
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
GITHUB_CLIENT_ID: z.string().optional(),
GITHUB_CLIENT_SECRET: z.string().optional(),
```

## Bước 4 — Update `src/lib/auth.ts` thêm `socialProviders`

```ts
socialProviders: {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  }),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  }),
},
```

## Bước 5 — Schema không cần regenerate

OAuth dùng bảng `account` đã có sẵn — KHÔNG cần `bun run auth:generate`.

## Bước 6 — Test curl

```bash
curl -i http://localhost:3000/api/auth/sign-in/social/google
# → Redirect 302 đến accounts.google.com
```

## Bước 7 — Frontend integration

`authClient.signIn.social({ provider: "google" })`

## Verify

- [ ] Env vars set
- [ ] `bun run validate` PASS
- [ ] Curl trả 302 redirect đúng provider
- [ ] Callback flow trả về `/api/auth/callback/google` thành công
- [ ] Bảng `account` có row mới sau khi login
