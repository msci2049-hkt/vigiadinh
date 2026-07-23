/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
// HOST-LOADED: this import MUST resolve to .mjs (see scripts/check-host-loaded.mjs).
import { defineAppConfig } from "@repo/config/vite";

export default defineAppConfig({
  srcDir: fileURLToPath(new URL("./src", import.meta.url)),
  port: 5173,
  // D-052: SW prompt-mode → toast "Có phiên bản mới — Tải lại" (update-toast.tsx).
  pwa: true,
  // CI deploy.yml cấp SENTRY_PROJECT_WEB (+ SENTRY_AUTH_TOKEN/SENTRY_ORG) để
  // upload source map. Local không set → không sinh/không upload map.
  sentryProject: process.env.SENTRY_PROJECT_WEB,
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Hermetic env for tests (don't depend on a local .env in CI). env.ts
    // validates import.meta.env at import time, so VITE_API_URL must exist.
    env: {
      VITE_API_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Vitest 4: coverage.include is required (no longer defaults to all files).
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/routeTree.gen.ts"],
    },
  },
});
