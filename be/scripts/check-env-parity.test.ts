// Test check-env-parity: extractKeys + compareFile (logic thuần, không I/O).
import { describe, expect, test } from "bun:test";
import { compareFile, extractKeys, INFRA_KEYS } from "./check-env-parity";

describe("extractKeys", () => {
  test("phân biệt key active vs key comment-documented", () => {
    const text = [
      "NODE_ENV=development",
      "# SENTRY_DSN=",
      "#   STRIPE_WEBHOOK_SECRET=whsec_xxx",
      "export DATABASE_URL=postgres://x",
      "# đây là comment thường, không phải key",
      "POSTGRES_USER=app",
    ].join("\n");
    const keys = extractKeys(text);
    expect(keys.active).toEqual(new Set(["NODE_ENV", "DATABASE_URL", "POSTGRES_USER"]));
    expect(keys.documented.has("SENTRY_DSN")).toBe(true);
    expect(keys.documented.has("STRIPE_WEBHOOK_SECRET")).toBe(true);
    expect(keys.active.has("SENTRY_DSN")).toBe(false);
  });
});

describe("compareFile", () => {
  const schemaKeys = ["NODE_ENV", "DATABASE_URL", "SENTRY_DSN"];

  test("key schema chưa document → missing", () => {
    const keys = extractKeys("NODE_ENV=dev\nDATABASE_URL=postgres://x");
    expect(compareFile(schemaKeys, keys).missing).toEqual(["SENTRY_DSN"]);
  });

  test("key optional để dạng comment → KHÔNG missing", () => {
    const keys = extractKeys("NODE_ENV=dev\nDATABASE_URL=postgres://x\n# SENTRY_DSN=");
    expect(compareFile(schemaKeys, keys).missing).toEqual([]);
  });

  test("key active lạ (không schema, không INFRA) → unknown", () => {
    const keys = extractKeys("NODE_ENV=dev\nDATABASE_URL=x\n# SENTRY_DSN=\nBIEN_LA=1");
    expect(compareFile(schemaKeys, keys).unknown).toEqual(["BIEN_LA"]);
  });

  test("key infra (POSTGRES_USER...) không bị coi là lạ", () => {
    expect(INFRA_KEYS.has("POSTGRES_USER")).toBe(true);
    const keys = extractKeys("NODE_ENV=dev\nDATABASE_URL=x\n# SENTRY_DSN=\nPOSTGRES_USER=app");
    expect(compareFile(schemaKeys, keys).unknown).toEqual([]);
  });
});
