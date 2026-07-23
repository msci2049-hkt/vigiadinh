# Thêm bảng điều khiển cho role mới = 3 bước cơ học

Kiến trúc: **một app — nhiều panel theo role**, qua registry `PANELS`
(`packages/auth/src/panels.ts`). Panel = 1 route group + 1 entry registry.
Shell (`apps/web/src/components/panel-shell.tsx`) đọc registry → sidebar/nav/
switcher tự cập nhật, KHÔNG sửa shell khi thêm panel.

Ví dụ: thêm panel cho role `moderator`.

## Bước 1 — Thêm role vào access-control (FE + BE phải KHỚP nhau)

`packages/auth/src/access-control.ts`:

```ts
export const roles = {
  admin: ac.newRole({ ...adminAc.statements }),
  // Mảng RỖNG cho từng resource — KHÔNG dùng ac.newRole({}): object rỗng
  // phá type variance của admin({ roles }) phía BE (code thật đã viết vậy).
  user: ac.newRole({ user: [], session: [] }),
  moderator: ac.newRole({ user: ["list", "ban"], session: [] }), // ← quyền của role mới
} as const;
```

`mau-demo-be/src/lib/access-control.ts`: thêm ĐÚNG role đó (mirror).
BE `src/lib/auth.ts` đã trỏ `admin({ ac, roles })` → tự nhận role mới.

## Bước 2 — Thêm 1 object vào PANELS

`packages/auth/src/panels.ts`:

```ts
{
  key: "moderator",
  roles: ["moderator", "admin"],        // admin được vào panel moderator
  basePath: "/moderator",
  labelKey: "panels.moderator.label",   // + key vào locales common.json
  nav: [
    { to: "/moderator", labelKey: "panels.moderator.nav.overview" },
    { to: "/moderator/reports", labelKey: "panels.moderator.nav.reports" },
  ],
},
```

Thêm labelKey vào `apps/web/src/locales/{vi,en}/common.json` mục `panels`.

## Bước 3 — Copy route group

```
apps/web/src/app/routes/_authenticated/
  _admin/            ← copy nguyên folder
  _moderator/
    route.tsx        ← đổi 2 chỗ: requireRoles(["moderator", "admin"])
                        + <PanelShell panelKey="moderator" />
    moderator/
      index.tsx      ← trang của panel (đổi nội dung theo nghiệp vụ)
      reports.tsx
```

Chạy `pnpm --filter @repo/web generate:routes` (hoặc để vite dev tự sinh).

## Sau khi thêm

- `defaultPanelPath(role)` tự trả `/moderator` cho user role moderator sau login.
- User có ≥2 panel (vd admin) tự thấy **switcher** ở sidebar.
- Route guard chỉ là UX — BE PHẢI tự re-check quyền trên mọi API (Better Auth
  admin plugin đã làm điều này cho các API `admin.*`).

## Khi panel cần tách domain/bundle riêng

Promote thành app riêng: tạo `apps/<panel>` (copy cấu trúc `apps/web`), move
route group + features sang đó. Core (`@repo/{core,ui,auth,i18n,config}`) đã ở
packages nên chỉ move phần route/feature — ví dụ thật: `apps/carbon`.
