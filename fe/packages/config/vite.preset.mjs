// ============================================================================
// Shared Vite preset for every app in the monorepo.
//
// ⚠️ HOST-LOADED FILE — Node imports this file DIRECTLY when Vite loads an
// app's vite.config.ts. It MUST stay .mjs (or .json): a .ts file here dies on
// hosts without type-stripping (Cloudflare CI, Node < 22.6, Node with
// --no-experimental-strip-types) with ERR_UNKNOWN_FILE_EXTENSION.
// scripts/check-host-loaded.mjs enforces this boundary in CI/pre-commit.
// ============================================================================
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

/**
 * Build the standard app config: TanStack Router (file-based, code-split) +
 * React + Tailwind v4, `@` alias, vendor manualChunks, and Vitest defaults.
 *
 * @param {object} options
 * @param {string} options.srcDir  Absolute path to the app's src/ (for the `@` alias).
 * @param {number} [options.port]  Dev-server port (each app gets its own).
 * @param {object} [options.test]  Extra Vitest config merged over the defaults
 *                                 (setupFiles, env, coverage, …).
 * @param {string} [options.sentryProject]  Sentry project slug của app — bật
 *                 upload source map khi CÓ kèm env SENTRY_AUTH_TOKEN (CI build).
 *                 Thiếu 1 trong 2 → không sinh map, không upload.
 * @param {boolean} [options.pwa]  Bật service worker (vite-plugin-pwa, D-052).
 *                 registerType "prompt" CÓ CHỦ ĐÍCH: SW mới đứng chờ (waiting)
 *                 → `onNeedRefresh` bắn → app hiện toast "Có phiên bản mới —
 *                 Tải lại" (components/update-toast.tsx). KHÔNG đổi sang
 *                 "autoUpdate": nó tự reload IM LẶNG (mất form state) và
 *                 onNeedRefresh không bao giờ bắn — user không được BIẾT.
 */
export function defineAppConfig({ srcDir, port = 5173, test = {}, sentryProject, pwa = false }) {
  // Upload source map chỉ ở CI có token (deploy.yml). Local build thường: tắt.
  const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && sentryProject);
  return defineConfig({
    plugins: [
      // tanstackRouter MUST come before @vitejs/plugin-react (codegen + code-split transforms).
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "./src/app/routes",
        generatedRouteTree: "./src/app/routeTree.gen.ts",
      }),
      react(),
      tailwindcss(),
      // PWA (D-052): CHỈ để user được BÁO khi có bản deploy mới (không im lặng
      // để họ gặp asset 404 rồi tưởng app hỏng). SW precache js/css/html nên
      // asset cũ vẫn phục vụ được cho tới khi user bấm "Tải lại".
      ...(pwa
        ? [
            VitePWA({
              registerType: "prompt",
              // Không cần manifest cài-app; mục tiêu chỉ là update-notify.
              manifest: false,
              workbox: {
                globPatterns: ["**/*.{js,css,html,svg,woff2}"],
                // .map (nếu có) và ảnh lớn không precache — tiết kiệm băng thông.
              },
            }),
          ]
        : []),
      // Sentry plugin PHẢI đứng CUỐI mảng plugins (yêu cầu @sentry/vite-plugin).
      // Map upload xong bị XOÁ khỏi dist (filesToDeleteAfterUpload) → deploy
      // không bao giờ ship .map public.
      ...(sentryUpload
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: sentryProject,
              authToken: process.env.SENTRY_AUTH_TOKEN,
              sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    server: {
      port,
    },
    build: {
      // "hidden": sinh map cho Sentry, KHÔNG ghi sourceMappingURL vào bundle.
      // Không upload → không sinh map (không ship map public khi thiếu token).
      sourcemap: sentryUpload ? "hidden" : false,
      rollupOptions: {
        output: {
          // Stable vendor chunks → CDN cache survives app-code deploys.
          // FUNCTION form: Vite 8 bundles with rolldown, which rejects the
          // object form ("manualChunks is not a function").
          manualChunks(id) {
            // Helper __vitePreload là module ảo dùng bởi MỌI chunk có dynamic
            // import. Không ghim thì rolldown có thể nhét nó vào một manual
            // chunk lazy (đã dính: rơi vào vendor-stellar → cả 444K thành
            // eager-preload). Ghim vào vendor-react — chunk eager sẵn.
            if (id.includes("vite/preload-helper")) {
              return "vendor-react";
            }
            if (/[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/.test(id)) {
              return "vendor-react";
            }
            if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) {
              return "vendor-tanstack";
            }
            // Cục nặng nhất của ví (~115K gz) và ít đổi nhất — tách tên riêng để
            // CDN cache sống qua các deploy đổi app-code. Vẫn LAZY: chỉ các route
            // ký/passkey import nó; manualChunks không đổi eagerness.
            if (/[\\/]node_modules[\\/](?:@stellar|smart-account-kit)[\\/]/.test(id)) {
              return "vendor-stellar";
            }
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      // Playwright specs live in e2e/ — keep Vitest out of them.
      exclude: [...configDefaults.exclude, "e2e/**"],
      ...test,
    },
  });
}
