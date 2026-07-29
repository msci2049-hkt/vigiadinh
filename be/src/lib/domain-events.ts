// Sự kiện domain qua SSE (LÔ 3, 2026-07-29) — đẩy NGAY khi nghiệp vụ xảy ra,
// không chờ tick của notification-dispatch. FE nghe event "domain" →
// invalidateQueries + toast; kênh email/notification vẫn đi đường queue cũ.
//
// LUẬT PAYLOAD (không thương lượng): KHÔNG secret — không token, không
// challenge_hash, không địa chỉ ví (kể cả rút gọn). Chỉ `type` + nhãn hiển thị
// do chủ ví tự đặt (`label`) — đủ cho toast "Anh ba vừa nhận lời", còn dữ liệu
// thật FE tự refetch qua API đã auth.
//
// Fire-and-forget đúng nghĩa: publishToUser đã nuốt lỗi vào logger (transport
// realtime.pub.error) — sự kiện realtime rớt KHÔNG được làm hỏng luồng nghiệp
// vụ, và người dùng vẫn còn refetch-on-focus + notification queue làm lưới đỡ.
import { publishToUser } from "@/lib/realtime";

export type DomainEventType =
  | "guardian.accepted"
  | "guardian.added"
  | "intent.awaiting_approval"
  | "intent.approved"
  | "intent.rejected"
  | "intent.cancelled"
  | "intent.expired";

export function publishDomainEvent(
  userId: string,
  type: DomainEventType,
  payload: { label?: string } = {},
): void {
  publishToUser(userId, "domain", { type, ...payload });
}
