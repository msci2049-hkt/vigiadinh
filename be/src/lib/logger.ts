// WHY: Một logger duy nhất cho toàn hệ thống — pino vì nhanh + JSON structured
// production parse được. Redact PII ngay tại logger để dev không cần nhớ
// scrub thủ công ở mỗi log call (lỡ là leak).
import pino, { type LoggerOptions } from "pino";
import { env } from "@/env";

const isProd = env.NODE_ENV === "production";

const baseOptions: LoggerOptions = {
  level: isProd ? "info" : "debug",
  // Redact áp dụng cả key trực tiếp lẫn nested. Pattern `*.X` = bất kỳ object 1
  // cấp có key X. Bổ sung path cụ thể cho header nhạy cảm.
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "apiKey",
      "*.apiKey",
      "creditCard",
      "*.creditCard",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "headers.authorization",
      "headers.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "set-cookie",
      "*.set-cookie",
      // FamilyWallet: định danh thiết bị của chủ ví/người bảo hộ
      // (devices.push_token, devices.fingerprint_hash) — lộ log là lộ đường
      // gửi silent push + vân tay máy. Rule .claude/rules/security.md.
      "pushToken",
      "*.pushToken",
      "push_token",
      "*.push_token",
      "fingerprintHash",
      "*.fingerprintHash",
      "fingerprint_hash",
      "*.fingerprint_hash",
    ],
    censor: "[REDACTED]",
  },
};

// Pretty transport CHỈ ở dev — production phải plain JSON cho log aggregator
// (Loki/CloudWatch) parse được. Cài qua devDependencies (`pino-pretty`).
export const logger = isProd
  ? pino(baseOptions)
  : pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
      },
    });

export type Logger = typeof logger;
