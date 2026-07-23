// NGUỒN SỰ THẬT các enum trạng thái dùng chung BE↔FE — mirror CHECK constraint
// trong schema. Module validators RE-EXPORT từ đây (1 nguồn duy nhất trong BE).
// FE cần thì COPY nội dung theo quy trình docs/CONTRACT-SYNC.md §4.
// Đổi giá trị = đổi CHECK constraint (migration) + sync FE + cập nhật CONTRACT-SYNC.
import { z } from "zod";

export const guardianStatusEnum = z.enum(["invited", "active", "slow", "offline", "removed"]);
export type GuardianStatus = z.infer<typeof guardianStatusEnum>;

export const deviceKindEnum = z.enum(["owner", "guardian"]);
export type DeviceKind = z.infer<typeof deviceKindEnum>;

// LUẬT: risk chỉ TRÌ HOÃN — không bao giờ có trạng thái "cancelled_by_risk".
export const recoveryStatusEnum = z.enum(["pending", "ready", "executed", "vetoed", "expired"]);
export type RecoveryStatus = z.infer<typeof recoveryStatusEnum>;

export const notificationStatusEnum = z.enum(["queued", "sent", "failed"]);
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;

export const notificationChannelEnum = z.enum(["push", "email", "sse"]);
export type NotificationChannel = z.infer<typeof notificationChannelEnum>;
