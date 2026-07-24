// Each table = 1 file. Auth schema sống cùng `src/db/schema/auth.ts` (CLI
// generated). Schema của business module sống TRONG module
// (`src/modules/<name>/infra/<name>.schema.ts`) — re-export ở đây để
// drizzle-kit pick up + giữ 1 entry duy nhất cho `drizzle({ schema })`.

// PrivateMessage: OUT (M9, checklist 3.1) — KHÔNG dựng bảng nhắn tin.
export * from "../../modules/care/infra/care-grants.schema";
export * from "../../modules/guardians/infra/guardians.schema";
export * from "../../modules/indexer/infra/audit-log.schema";
export * from "../../modules/indexer/infra/checkpoint.schema";
export * from "../../modules/inheritance/infra/heartbeats.schema";
export * from "../../modules/inheritance/infra/heirs.schema";
export * from "../../modules/inheritance/infra/inheritance-plans.schema";
export * from "../../modules/intents/infra/approvals.schema";
export * from "../../modules/intents/infra/intents.schema";
export * from "../../modules/notifications/infra/notifications.schema";
export * from "../../modules/presence/infra/devices.schema";
export * from "../../modules/presence/infra/presence-pings.schema";
export * from "../../modules/product/infra/products.schema";
export * from "../../modules/recovery/infra/recovery-requests.schema";
export * from "../../modules/wallets/infra/families.schema";
export * from "../../modules/wallets/infra/wallets.schema";
export * from "./auth";
