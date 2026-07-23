// Bọc zod quanh enum trạng thái dùng chung BE↔FE — NGUỒN là shared/contract.ts ở root
// monorepo (bản copy AUTO-SYNC: ./contract.ts). Module validators RE-EXPORT từ đây.
// Đổi giá trị = sửa shared/contract.ts → `bun run sync:contract` → migration CHECK constraint mới.
import { z } from "zod";
import {
  DEVICE_KINDS,
  GUARDIAN_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  RECOVERY_STATUSES,
} from "./contract";

export const guardianStatusEnum = z.enum(GUARDIAN_STATUSES);
export type GuardianStatus = z.infer<typeof guardianStatusEnum>;

export const deviceKindEnum = z.enum(DEVICE_KINDS);
export type DeviceKind = z.infer<typeof deviceKindEnum>;

// LUẬT: risk chỉ TRÌ HOÃN — không bao giờ có trạng thái "cancelled_by_risk".
export const recoveryStatusEnum = z.enum(RECOVERY_STATUSES);
export type RecoveryStatus = z.infer<typeof recoveryStatusEnum>;

export const notificationStatusEnum = z.enum(NOTIFICATION_STATUSES);
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;

export const notificationChannelEnum = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof notificationChannelEnum>;
