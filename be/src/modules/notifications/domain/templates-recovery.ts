// Template nhóm KHÔI PHỤC — tách khỏi templates.ts (trần 300 dòng/file) khi thêm
// recovery.wallet_lookup (R4 nhóm C). Cùng luật catalog: ICU, render theo locale
// NGƯỜI NHẬN lúc gửi, en mặc định, chữ người thường — cấm jargon guardian/threshold.
import type { NotificationTemplate } from "./templates";

export const RECOVERY_TEMPLATES: Record<string, Record<string, NotificationTemplate>> = {
  "recovery.device_requested": {
    en: {
      title: "Someone lost access and asks for your help",
      body: "A new device says it belongs to the owner of a wallet you protect. Call them to verify, then review the request in the app. Nothing happens without enough family approvals.",
    },
    vi: {
      title: "Có người mất quyền truy cập và cần bạn giúp",
      body: "Một thiết bị mới nói rằng nó thuộc về chủ ví mà bạn đang bảo hộ. Hãy gọi xác minh với họ, rồi xem yêu cầu trong ứng dụng. Chưa có gì xảy ra khi chưa đủ người thân đồng ý.",
    },
    zh: {
      title: "有人失去了访问权限，需要您帮忙",
      body: "一台新设备声称属于您正在守护的钱包主人。请先打电话向本人核实，再到应用中查看该请求。在家人同意的人数不足之前，不会发生任何变动。",
    },
  },
  "recovery.initiated": {
    en: {
      title: "Wallet recovery started",
      body: "Someone asked to take over this wallet through the family recovery process. If this is NOT you or family helping you, block it now from any of your devices.",
    },
    vi: {
      title: "Có yêu cầu khôi phục ví",
      body: "Có người yêu cầu tiếp quản ví này qua quy trình khôi phục gia đình. Nếu KHÔNG phải bạn hoặc người thân đang giúp bạn, hãy chặn ngay từ bất kỳ thiết bị nào của bạn.",
    },
    zh: {
      title: "有人申请恢复钱包",
      body: "有人正通过家人恢复流程申请接管这个钱包。如果这不是您本人、也不是家人在帮您，请立即用您的任一设备阻止。",
    },
  },
  "recovery.approved": {
    en: {
      title: "A trusted contact confirmed the recovery",
      body: "One more trusted contact has confirmed the request to recover this wallet. If this is unexpected, block it now.",
    },
    vi: {
      title: "Một người thân đã xác nhận khôi phục",
      body: "Thêm một người thân đã xác nhận yêu cầu khôi phục ví này. Nếu bạn thấy bất thường, hãy chặn ngay.",
    },
    zh: {
      title: "一位家人已确认此次恢复",
      body: "又有一位家人确认了恢复这个钱包的请求。如果这出乎您的意料，请立即阻止。",
    },
  },
  // R6 — mốc ĐỦ PHIẾU, khác hẳn recovery.approved ("thêm một người thân"): từ
  // giây này đồng hồ chặn chạy thật và chủ ví chỉ còn {hours} giờ. Trước lô này
  // mốc nguy hiểm nhất của cả sản phẩm là mốc DUY NHẤT không có lá thư nào.
  "recovery.threshold_met": {
    en: {
      title: "Enough family members have confirmed",
      body: "Everyone needed has now confirmed the request to move this wallet to a new device. It will move in about {hours, plural, one {# hour} other {# hours}}. If this is not you, block it now from any of your devices.",
    },
    vi: {
      title: "Đã đủ người thân xác nhận",
      body: "Đã đủ người xác nhận yêu cầu chuyển ví này sang thiết bị mới. Ví sẽ chuyển sau khoảng {hours, plural, other {# giờ}}. Nếu không phải bạn, hãy chặn ngay từ bất kỳ thiết bị nào của bạn.",
    },
    zh: {
      title: "家人确认人数已足够",
      body: "所需的家人都已确认将这个钱包转到新设备的申请。大约 {hours, plural, other {# 小时}} 后就会转移。如果这不是您本人，请立即用您的任一设备阻止。",
    },
  },
  "recovery.finalized": {
    en: {
      title: "Wallet recovery completed",
      body: "The recovery process finished and the wallet now answers to the new key. If this was not expected, contact your family and review wallet activity immediately.",
    },
    vi: {
      title: "Khôi phục ví hoàn tất",
      body: "Quy trình khôi phục đã xong, ví giờ thuộc về khoá mới. Nếu điều này ngoài dự kiến, hãy liên hệ người thân và kiểm tra hoạt động của ví ngay.",
    },
    zh: {
      title: "钱包恢复已完成",
      body: "恢复流程已结束，钱包现在由新密钥掌管。如果这出乎您的意料，请立即联系家人并检查钱包的活动记录。",
    },
  },
  "recovery.vetoed": {
    en: {
      title: "Recovery attempt stopped",
      body: "A request to take over this wallet was BLOCKED. If you did not block it yourself, review your wallet activity now.",
    },
    vi: {
      title: "Đã chặn một yêu cầu khôi phục",
      body: "Một yêu cầu chiếm quyền ví đã bị CHẶN. Nếu không phải bạn chặn, hãy kiểm tra hoạt động của ví ngay.",
    },
    zh: {
      title: "已阻止一次恢复申请",
      body: "一次接管钱包的申请已被阻止。如果不是您本人阻止的，请立即检查钱包的活动记录。",
    },
  },
  // R5 nhóm A — gửi cho MỌI NGƯỜI BẢO HỘ khi yêu cầu khôi phục ĐÓNG (huỷ/veto/
  // finalize), kể cả người CHƯA duyệt. Giọng TIN TỐT, không phải cảnh báo:
  // người nhận là người được nhờ giúp, việc đã xong, họ không cần làm gì —
  // khác hẳn recovery.vetoed (cảnh báo cho CHỦ VÍ "nếu không phải bạn chặn…").
  "recovery.closed": {
    en: {
      title: "The recovery request is closed",
      body: "The wallet owner is back in their wallet. The recovery request you were asked to help with is closed — nothing more for you to do.",
    },
    vi: {
      title: "Yêu cầu khôi phục đã đóng",
      body: "Chủ ví đã vào lại được ví của họ. Yêu cầu khôi phục bạn được nhờ giúp đã đóng, bạn không cần làm gì thêm.",
    },
    zh: {
      title: "恢复请求已关闭",
      body: "钱包主人已经重新进入了自己的钱包。您受邀协助的恢复请求已关闭，您无需再做任何操作。",
    },
  },
  // R4 nhóm C — params khi enqueue: link (/recovery/find-wallet?address=… điền
  // sẵn). Địa chỉ ví nằm TRONG link gửi tới hộp thư chính chủ — không bao giờ
  // nằm trong HTTP response của cửa tra cứu (chống lộ danh sách người dùng).
  "recovery.wallet_lookup": {
    en: {
      title: "The way back into your wallet",
      body: "You (or someone using this email) asked to find the wallet linked to it. Open this link on the device you are recovering with and your wallet address will be filled in for you: {link} — If this was not you, you can ignore this email. Nothing has changed.",
    },
    vi: {
      title: "Đường quay lại ví của bạn",
      body: "Bạn (hoặc ai đó dùng email này) vừa nhờ tìm ví gắn với email. Hãy mở đường dẫn sau trên chính thiết bị bạn đang dùng để khôi phục, địa chỉ ví sẽ được điền sẵn: {link} — Nếu không phải bạn, cứ bỏ qua thư này. Chưa có gì thay đổi.",
    },
    zh: {
      title: "找回钱包的入口",
      body: "您（或使用此邮箱的人）请求查找与此邮箱关联的钱包。请在您正用来恢复的设备上打开以下链接，钱包地址会自动填好：{link} — 如果这不是您本人操作，请忽略此邮件，一切都没有变化。",
    },
  },
};
