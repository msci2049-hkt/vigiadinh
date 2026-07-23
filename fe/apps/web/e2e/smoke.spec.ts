import { expect, test } from "@playwright/test";
import { loadEnv } from "vite";

// The tab <title> is single-sourced from VITE_APP_NAME (Vite substitutes
// %VITE_APP_NAME% in index.html). Read the same value the build used so renaming
// the app never breaks this assertion.
const APP_NAME = loadEnv("production", process.cwd(), "VITE_").VITE_APP_NAME || "Mau Demo FE";

// All smoke tests run WITHOUT a backend: health/SSE/data calls fail gracefully,
// and the protected-route guard treats a failed getSession as "unauthenticated".

test("home renders with the app title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(APP_NAME);
});

test("navigates home → login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Đăng nhập" }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

test("protected /dashboard redirects to /login when unauthenticated", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test("theme toggle applies .dark and persists across reload (FOUC guard)", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Chuyển giao diện sáng/tối" }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/); // inline script set it before first paint
});

test("health badge shows disconnected without a backend", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("BE: mất kết nối")).toBeVisible();
});

test("language switch toggles vi ⇄ en", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Trang chủ" })).toBeVisible();

  await page.getByRole("button", { name: "Ngôn ngữ" }).click();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});
