import { expect, type Page, test } from "@playwright/test";

// Admin-panel E2E without a backend: mock Better Auth get-session (role-based)
// + the admin listUsers endpoint via page.route. Covers the WP gates:
//   non-admin → /unauthorized (403), admin → /admin/users table,
//   F5 on /admin does NOT mis-redirect while the session loads.

function sessionOf(role: "admin" | "user") {
  return {
    user: {
      id: `u_${role}`,
      email: `${role}@example.com`,
      name: role === "admin" ? "Admin User" : "Normal User",
      emailVerified: true,
      role,
      banned: false,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    },
    session: { id: "s1", userId: `u_${role}`, token: "tok", expiresAt: "2027-01-01T00:00:00Z" },
  };
}

const USERS_PAGE = {
  users: [
    {
      id: "u1",
      email: "farmer@example.com",
      name: "Anh Tú",
      role: "user",
      banned: false,
      emailVerified: true,
      createdAt: "2026-06-02T00:00:00Z",
    },
    {
      id: "u2",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      banned: false,
      emailVerified: true,
      createdAt: "2026-06-01T00:00:00Z",
    },
  ],
  total: 2,
};

async function mockAuth(page: Page, role: "admin" | "user") {
  await page.route("**/api/auth/get-session", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionOf(role)),
    }),
  );
  await page.route("**/api/auth/admin/list-users**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(USERS_PAGE),
    }),
  );
}

test("non-admin bị chặn: /admin → /unauthorized (403)", async ({ page }) => {
  await mockAuth(page, "user");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/unauthorized/);
  await expect(page.getByRole("heading", { name: /403/ })).toBeVisible();
});

test("chưa đăng nhập: /admin → /login?redirect=", async ({ page }) => {
  // No get-session mock → request fails → treated as signed-out.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test("admin vào /admin/users: bảng users render từ listUsers", async ({ page }) => {
  await mockAuth(page, "admin");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Người dùng" })).toBeVisible();
  await expect(page.getByText("farmer@example.com")).toBeVisible();
  await expect(page.getByText("2 người dùng")).toBeVisible();
});

test("F5 trên /admin: session trong context → KHÔNG redirect nhầm", async ({ page }) => {
  await mockAuth(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Tổng quan quản trị" })).toBeVisible();

  await page.reload();
  // Sau reload vẫn ở /admin (beforeLoad await session xong mới render).
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Tổng quan quản trị" })).toBeVisible();
});

test("panel shell: sidebar nav đủ 4 mục từ PANELS registry", async ({ page }) => {
  await mockAuth(page, "admin");
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Quản trị" });
  await expect(nav.getByRole("link", { name: "Tổng quan" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Người dùng" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Lượt truy cập" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Cài đặt" })).toBeVisible();
});
