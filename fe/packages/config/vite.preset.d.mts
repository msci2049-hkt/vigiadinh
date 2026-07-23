// Type companion for vite.preset.mjs (the runtime file stays .mjs — host-loaded).
import type { UserConfig } from "vite";

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
   */
  pwa?: boolean;
}

export declare function defineAppConfig(options: DefineAppConfigOptions): UserConfig;
