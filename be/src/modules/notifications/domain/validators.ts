// WHY: enum là CONTRACT BE↔FE → nguồn duy nhất ở @/shared-contract (mirror CHECK
// trong infra/notifications.schema.ts).
export {
  type NotificationChannel,
  type NotificationStatus,
  notificationChannelEnum,
  notificationStatusEnum,
} from "@/shared-contract";
