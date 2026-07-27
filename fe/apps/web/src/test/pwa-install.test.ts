// WHY: "cài lên màn hình chính" hỏng theo kiểu KHÔNG có thông báo lỗi nào.
//
// Trước 2026-07-27 app chạy `VitePWA({ manifest: false })` — service worker CÓ
// chạy và precache, nên mọi dấu hiệu bề ngoài đều như một PWA đầy đủ, nhưng
// không có manifest thì trình duyệt không bao giờ mời cài và không bao giờ vào
// `display-mode: standalone`. Không log, không cảnh báo, không màn đỏ.
//
// Cùng kiểu im lặng đó có ba cái bẫy nữa, và test này khoá cả ba:
//
//   1. Chrome đòi icon >= 192px mới cho cài. Icon khai trong manifest mà FILE
//      KHÔNG TỒN TẠI hoặc SAI KÍCH THƯỚC thì nút "Cài đặt" đơn giản là không
//      hiện ra — nên ta đọc thẳng IHDR của PNG chứ không tin dòng `sizes`.
//   2. iOS KHÔNG đọc icon từ manifest. Thiếu `<link rel="apple-touch-icon">` là
//      màn hình chính hiện ảnh chụp màn hình trang web thay cho icon.
//   3. iOS cũng không dùng `display: standalone` của manifest — nó đọc
//      `<meta name="apple-mobile-web-app-capable">`. Thiếu thẻ đó thì Android
//      chạy đúng còn iOS vẫn mở trong tab Safari có thanh địa chỉ. Lệch nền tảng
//      là chế độ hỏng khó thấy nhất vì bên chạy được sẽ thuyết phục ta là xong.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const APP_DIR = join(import.meta.dirname, "../..");
const INDEX_HTML = readFileSync(join(APP_DIR, "index.html"), "utf8");

/**
 * Bỏ comment trước khi dò cấu hình. Cần thật: chính file config này có comment
 * GIẢI THÍCH trạng thái cũ (`pwa: true`), và không bỏ comment thì test bắt nhầm
 * lời kể về quá khứ rồi báo đỏ một cấu hình đang đúng.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const VITE_CONFIG = stripComments(readFileSync(join(APP_DIR, "vite.config.ts"), "utf8"));

/** Đọc kích thước thật từ IHDR (byte 16–24 của PNG), không tin tên file. */
function pngSize(relativePath: string): { width: number; height: number } {
  const buf = readFileSync(join(APP_DIR, "public", relativePath.replace(/^\//, "")));
  expect(buf.subarray(1, 4).toString("ascii"), `${relativePath} không phải PNG`).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Các icon manifest khai trong vite.config.ts: [đường dẫn, "192x192", purpose?]. */
const manifestIcons = [
  ...VITE_CONFIG.matchAll(/src:\s*"([^"]+)",\s*\n?\s*sizes:\s*"(\d+)x(\d+)"/g),
];

describe("manifest PWA — app phải CÀI được lên màn hình chính", () => {
  test("vite.config bật manifest (object), không phải chế độ chỉ-update-notify", () => {
    // `pwa: true` = manifest:false = không cài được. Đây là trạng thái cũ.
    expect(VITE_CONFIG).not.toMatch(/pwa:\s*true/);
    expect(VITE_CONFIG).toMatch(/pwa:\s*\{/);
  });

  test("khai đủ icon, và có icon >= 192px (ngưỡng cho cài của Chrome)", () => {
    expect(manifestIcons.length).toBeGreaterThanOrEqual(2);
    const largest = Math.max(...manifestIcons.map((m) => Number(m[2])));
    expect(largest).toBeGreaterThanOrEqual(192);
  });

  test.each(
    manifestIcons.map((m) => [m[1] as string, Number(m[2]), Number(m[3])]),
  )("%s tồn tại và ĐÚNG %ix%i pixel thật", (path, width, height) => {
    expect(pngSize(path)).toEqual({ width, height });
  });

  test("icon maskable là FILE RIÊNG, không dùng lại icon vẽ tràn viền", () => {
    // Android cắt icon maskable theo mặt nạ của máy: chủ thể phải nằm trong
    // đường tròn 0.8·cạnh. Gắn purpose maskable lên icon full-bleed = linh vật
    // bị xén cụt tay chân, và chỉ thấy được trên máy Android thật.
    const maskable = VITE_CONFIG.match(/src:\s*"([^"]+)",[\s\S]{0,120}?purpose:\s*"maskable"/);
    expect(maskable?.[1]).toBeDefined();
    const anyIcons = manifestIcons
      .filter((m) => !m[0].includes("maskable"))
      .map((m) => m[1] as string);
    expect(anyIcons).not.toContain(maskable?.[1]);
  });
});

describe("index.html — ba thẻ iOS mà vite-plugin-pwa KHÔNG tự chèn", () => {
  test("apple-touch-icon trỏ tới file PNG có thật (iOS bỏ qua icon của manifest)", () => {
    const href = INDEX_HTML.match(/rel="apple-touch-icon"\s+href="([^"]+)"/)?.[1];
    expect(href, "thiếu <link rel=apple-touch-icon>").toBeDefined();
    const size = pngSize(href as string);
    // Apple khuyến nghị 180×180 cho màn hình hiện đại; nhỏ hơn là icon bị kéo mờ.
    expect(size.width).toBeGreaterThanOrEqual(180);
    expect(size.width).toBe(size.height);
  });

  test("apple-mobile-web-app-capable — thiếu là iOS vẫn mở trong tab Safari", () => {
    expect(INDEX_HTML).toMatch(/name="apple-mobile-web-app-capable"\s+content="yes"/);
  });

  test("theme-color có mặt và khớp nền giấy của app", () => {
    expect(INDEX_HTML).toMatch(/name="theme-color"\s+content="#fdfcf7"/i);
  });
});
