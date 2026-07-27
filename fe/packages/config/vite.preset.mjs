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
import { defineConfig, loadEnv } from "vite";
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
 * @param {boolean|object} [options.pwa]  Bật service worker (vite-plugin-pwa, D-052).
 *                 registerType "prompt" CÓ CHỦ ĐÍCH: SW mới đứng chờ (waiting)
 *                 → `onNeedRefresh` bắn → app hiện toast "Có phiên bản mới —
 *                 Tải lại" (components/update-toast.tsx). KHÔNG đổi sang
 *                 "autoUpdate": nó tự reload IM LẶNG (mất form state) và
 *                 onNeedRefresh không bao giờ bắn — user không được BIẾT.
 *
 *                 `true`  = chỉ update-notify, KHÔNG manifest → app KHÔNG cài
 *                           lên màn hình chính được.
 *                 object  = có manifest → app cài được. App cấp phần THƯƠNG HIỆU
 *                           (`themeColor`, `backgroundColor`, `description`,
 *                           `icons`); preset tự điền `name`/`short_name`.
 *
 *                 ⚠️ `name` KHÔNG nhận từ app: nó phải là CÙNG MỘT nguồn với
 *                 `<title>` và `rpName` (= `VITE_APP_NAME`). Cho app tự khai là
 *                 mở đường cho đúng thứ vừa phải sửa ở §1.3 — tên trên màn hình
 *                 chính lệch tên trong hộp thoại vân tay. Preset đọc bằng
 *                 `loadEnv` nên lấy được cả từ `.env` (dev) lẫn biến môi trường
 *                 của step build (CI), giống hệt cách Vite thay `%VITE_APP_NAME%`.
 */
/**
 * Ghép manifest cài-app. Tên LUÔN đến từ `VITE_APP_NAME` — xem ghi chú ở
 * `options.pwa`. Thiếu biến là THROW: manifest mang tên sai còn tệ hơn không có
 * manifest, vì tên đó nằm dưới icon trên màn hình chính và không ai đọc lại.
 */
function buildManifest(branding, mode, command, srcDir) {
  // `srcDir` là `<app>/src` → thư mục env của app là cha nó (nơi có .env).
  const envDir = srcDir.replace(/[\\/]src[\\/]?$/, "");
  const appName = loadEnv(mode, envDir, "VITE_").VITE_APP_NAME;
  if (!appName) {
    // THROW CHỈ KHI BUILD. Vitest nạp chính file config này, và `test.env` của nó
    // CỐ Ý hermetic ("don't depend on a local .env in CI" — apps/web/vite.config.ts).
    // Throw ở mọi command làm `pnpm test` chết ngay lúc nạp config khi máy chưa có
    // `.env` — tức bắt test phụ thuộc đúng cái thứ nó vừa tuyên bố là không.
    // Đo thật 2026-07-27: dời `.env` đi một lát là vitest chết ở vite.preset.mjs:104.
    // Chỉ bản BUILD mới ship manifest ra ngoài, nên đó mới là chỗ đáng fail-closed.
    if (command === "build") {
      throw new Error(
        "VITE_APP_NAME trống — manifest PWA sẽ mang tên rỗng trên màn hình chính. " +
          "Đặt trong <app>/.env (dev) hoặc env của step build (CI). Xem .env.example.",
      );
    }
    // serve/test: manifest không đi đâu cả. Trả về `false` để plugin bỏ qua hẳn,
    // thay vì sinh một manifest tên rỗng rồi dev tưởng mình cài được app.
    return false;
  }
  return {
    name: appName,
    short_name: appName,
    description: branding.description,
    // start_url "/" chứ không phải "." — Android lưu URL này lúc CÀI và không
    // bao giờ hỏi lại; đường dẫn tương đối sẽ đóng băng theo route người dùng
    // đang đứng lúc bấm "Thêm vào màn hình chính".
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    icons: branding.icons,
  };
}

export function defineAppConfig({ srcDir, port = 5173, test = {}, sentryProject, pwa = false }) {
  // Upload source map chỉ ở CI có token (deploy.yml). Local build thường: tắt.
  const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN && sentryProject);
  return defineConfig(({ mode, command }) => ({
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
              // `pwa: true` (không manifest) = chỉ update-notify, app KHÔNG cài được.
              manifest: typeof pwa === "object" ? buildManifest(pwa, mode, command, srcDir) : false,
              // ⚠️ `includeManifestIcons` MẶC ĐỊNH true và nó BỎ QUA globPatterns:
              // đo thật trên dist 2026-07-27, ba icon PNG (231 KiB) vào precache dù
              // globPatterns không hề có `png`. Icon chỉ được HỆ ĐIỀU HÀNH đọc lúc
              // CÀI app, không phải trang đọc lúc chạy — precache chúng là bắt MỌI
              // khách (kể cả người không bao giờ cài) tải thêm 231 KiB.
              includeManifestIcons: false,
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
  }));
}
