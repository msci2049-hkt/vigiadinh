export type {
  NewNotification,
  Notification,
  NotificationChannel,
  NotificationStatus,
} from "./domain/notification.entity";
// Cho module khác enqueue thông báo qua facade (PHA 4.1 — presence notify chủ ví).
export {
  enqueue as enqueueNotification,
  enqueueTx as enqueueNotificationTx,
} from "./infra/notifications.repository";
