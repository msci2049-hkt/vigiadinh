import { expect, type Page, test } from "@playwright/test";

// Better Auth client (verified from installed source) calls `/api/auth/*` over
// @better-fetch — any 2xx JSON = success (error null). We stub the whole namespace
// so login + getSession succeed WITHOUT a backend.
const AUTH_SESSION = {
  user: { id: "u1", email: "user@example.com", name: "Test User", emailVerified: true },
  session: { id: "s1", userId: "u1" },
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(AUTH_SESSION),
    }),
  );
}

async function submitLogin(page: Page) {
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Mật khẩu").fill("password123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

test("successful login redirects to a valid internal path", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/login?redirect=/wallet");
  await submitLogin(page);

  await expect(page).toHaveURL(/\/wallet$/);
  await expect(page.getByRole("heading", { name: "Ví của bạn" })).toBeVisible();
});

test("open redirect via protocol-relative URL is blocked", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/login?redirect=//evil.com");
  await submitLogin(page);

  // Sanitized away → falls back to postAuthPath = /wallet. Never off-origin.
  await expect(page).toHaveURL(/\/wallet$/);
});

test("open redirect via absolute URL is blocked", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/login?redirect=https://evil.com");
  await submitLogin(page);

  await expect(page).toHaveURL(/\/wallet$/);
});
