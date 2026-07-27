// Type companion for vite.preset.mjs (the runtime file stays .mjs — host-loaded).
import type { UserConfigExport } from "vite";

/** Một mục `icons` của manifest — khớp đúng Web App Manifest. */
export interface PwaIcon {
  src: string;
  sizes: string;
  type: string;
  /** "maskable" → Android cắt theo mặt nạ máy; chủ thể phải nằm trong 0.8·cạnh. */
  purpose?: string;
}

/**
 * Phần THƯƠNG HIỆU của manifest do app cấp. CỐ Ý không có `name`/`short_name`:
 * preset lấy chúng từ `VITE_APP_NAME` để tên trên màn hình chính không bao giờ
 * lệch `<title>` và `rpName` (chữ trong hộp thoại vân tay).
 */
export interface PwaBranding {
  description: string;
  themeColor: string;
  backgroundColor: string;
  icons: PwaIcon[];
}

export interface DefineAppConfigOptions {
  /** Absolute path to the app's src/ (for the `@` alias). */
  srcDir: string;
  /** Dev-server port (each app gets its own). */
  port?: number;
  /** Extra Vitest config merged over the defaults (setupFiles, env, coverage, …). */
  test?: Record<string, unknown>;
  /**
   * Sentry project slug của app — bật upload source map khi CÓ kèm env
   * SENTRY_AUTH_TOKEN (CI build). Thiếu 1 trong 2 → không sinh/không upload map.
   */
  sentryProject?: string | undefined;
  /**
   * Bật service worker (vite-plugin-pwa, D-052). registerType "prompt" CÓ CHỦ
   * ĐÍCH: SW mới đứng chờ → onNeedRefresh bắn → toast "Có phiên bản mới — Tải
   * lại". KHÔNG đổi sang "autoUpdate" (tự reload im lặng, user không được báo).
   *
   * `true`   = chỉ update-notify, KHÔNG manifest → app KHÔNG cài lên màn hình
   *            chính được (trạng thái trước 2026-07-27; xem BLOCKERS B-FE-10).
   * `object` = có manifest → app cài được.
   */
  pwa?: boolean | PwaBranding;
}

/**
 * Trả về DẠNG HÀM (`UserConfigExport`), không phải object: preset cần `mode` để
 * `loadEnv` đọc `VITE_APP_NAME` cho manifest — lấy được cả từ `.env` của app
 * (dev) lẫn biến môi trường của step build (CI).
 */
export declare function defineAppConfig(options: DefineAppConfigOptions): UserConfigExport;
