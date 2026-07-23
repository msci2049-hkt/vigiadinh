// NGUỒN SỰ THẬT enum trạng thái dùng chung BE↔FE — mirror CHECK constraint trong DB.
// Nằm ở root monorepo; be/ và fe/ KHÔNG import trực tiếp file này (hai bên build riêng).
// Quy trình: sửa TẠI ĐÂY → `bun run sync:contract` (copy sang 2 bên) → `bun run check:contract`.
// Dependency-free (không zod) để dùng được cả BE (bun) lẫn FE (pnpm); bên nào cần zod thì
// tự bọc `z.enum(GUARDIAN_STATUSES)` ở phía mình.
// Đổi giá trị = đổi CHECK constraint (migration mới) + sync + cập nhật docs/CONTRACT-SYNC.md.

export const GUARDIAN_STATUSES = ["invited", "active", "slow", "offline", "removed"] as const;
export type GuardianStatus = (typeof GUARDIAN_STATUSES)[number];

export const DEVICE_KINDS = ["owner", "guardian"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

// LUẬT: risk chỉ TRÌ HOÃN — không bao giờ có trạng thái "cancelled_by_risk".
export const RECOVERY_STATUSES = ["pending", "ready", "executed", "vetoed", "expired"] as const;
export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];

export const NOTIFICATION_STATUSES = ["queued", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["push", "email", "sse"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
