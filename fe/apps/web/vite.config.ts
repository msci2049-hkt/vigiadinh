/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
// HOST-LOADED: this import MUST resolve to .mjs (see scripts/check-host-loaded.mjs).
import { defineAppConfig } from "@repo/config/vite";

export default defineAppConfig({
  srcDir: fileURLToPath(new URL("./src", import.meta.url)),
  port: 5173,
  // D-052: SW prompt-mode → toast "Có phiên bản mới — Tải lại" (update-toast.tsx).
  //
  // Manifest CÓ THẬT (quyết định 2026-07-27): ví này dành cho bố mẹ ở quê, và
  // "cài lên màn hình chính" là luồng ta MUỐN hỗ trợ — mở app bằng một icon thay
  // vì nhớ địa chỉ web. Trước đó `pwa: true` (manifest: false) nên khối
  // `@media (display-mode: standalone)` trong components/family/family.css là
  // CODE CHẾT: không manifest thì trình duyệt không bao giờ vào standalone.
  //
  // `name`/`short_name` KHÔNG khai ở đây — preset lấy từ VITE_APP_NAME, cùng
  // nguồn với <title> và rpName (xem packages/config/vite.preset.mjs).
  pwa: {
    description: "A wallet your family can help you recover",
    // `--fw-paper` (components/family/family.css) — nền giấy của chính app, nên
    // thanh trạng thái Android và splash không nháy sang màu lạ lúc mở.
    themeColor: "#fdfcf7",
    backgroundColor: "#fdfcf7",
    // Sinh lại bằng `node scripts/make-app-icons.mjs` (nguồn: linh vật ngôi sao).
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // File RIÊNG cho maskable, KHÔNG dùng lại hai file trên: Android cắt icon
      // theo mặt nạ của máy, nên chủ thể phải nằm gọn trong đường tròn 0.8·cạnh.
      // Gắn `purpose: "any maskable"` lên icon vẽ tràn viền là cách kinh điển để
      // linh vật bị xén cụt tay chân trên máy Android.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  // CI deploy.yml cấp SENTRY_PROJECT_WEB (+ SENTRY_AUTH_TOKEN/SENTRY_ORG) để
  // upload source map. Local không set → không sinh/không upload map.
  sentryProject: process.env.SENTRY_PROJECT_WEB,
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Hermetic env for tests (don't depend on a local .env in CI). env.ts
    // validates import.meta.env at import time, so VITE_API_URL must exist.
    env: {
      VITE_API_URL: "http://localhost:3000",
      // Mainnet migration: 2 biến Stellar hết default (fail-closed) — test
      // hermetic phải cấp TƯỜNG MINH. Giá trị testnet ở đây là fixture của
      // test, không phải default ngầm của app.
      VITE_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      VITE_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
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
