import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the PRODUCTION build served by `vite preview` (no backend
 * required — auth is mocked per-test via page.route). `webServer` builds + starts
 * preview automatically. locale is pinned to vi-VN so i18n text is deterministic.
 */
const PORT = 4174;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serialize in CI for stable timing; omit (Playwright default) locally.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "vi-VN",
    colorScheme: "light",
    trace: "on-first-retry",
    // D-052: dist giờ có service worker (vite-plugin-pwa). Block trong e2e để
    // page.route mock không bị SW cache/fetch qua mặt — SW test riêng bằng tay.
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `corepack pnpm build && corepack pnpm preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Monorepo build (tsc + vite) can be slow on CI/WSL — generous timeout.
    timeout: 300_000,
  },
});
