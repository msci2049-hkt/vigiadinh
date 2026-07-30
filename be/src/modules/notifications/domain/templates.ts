// Catalog template ICU (PHA 4.3) — render theo locale NGƯỜI NHẬN lúc GỬI
// (fw-indexer-notify: DB chỉ giữ template_key + params, KHÔNG lưu chuỗi đã dịch).
// en mặc định + vi (sản phẩm toàn cầu). Chuỗi NGƯỜI THƯỜNG — cấm jargon
// guardian/threshold/timelock (rule i18n): "người thân được nhờ trông ví".
// Từng chuỗi qua giọng ux-writer: chuyện gì · vì sao/ai · làm gì tiếp.
export type NotificationTemplate = { title: string; body: string };

type Catalog = Record<string, Record<string, NotificationTemplate>>;

export const TEMPLATES: Catalog = {
  "presence.guardian_offline": {
    en: {
      title: "A trusted contact lost connection",
      body: "{guardianName, select, undefined {One of your trusted contacts} other {{guardianName}}} has been unreachable for more than 3 days. If your wallet ever needs recovering, this person may not be able to help right now.",
    },
    vi: {
      title: "Một người thân đã mất kết nối",
      body: "{guardianName, select, undefined {Một người thân bạn nhờ trông ví} other {{guardianName}}} đã mất kết nối hơn 3 ngày. Nếu ví cần khôi phục, người này có thể không giúp kịp lúc này.",
    },
  },
  "presence.guardian_slow": {
    en: {
      title: "A trusted contact has been quiet",
      body: "A device of one of your trusted contacts hasn't checked in for over a day. Nothing to do yet — we'll tell you if it goes silent longer.",
    },
    vi: {
      title: "Một người thân im ắng hơn thường lệ",
      body: "Máy của một người thân đã hơn một ngày chưa phản hồi. Chưa cần làm gì — nếu im lặng lâu hơn, chúng tôi sẽ báo bạn.",
    },
  },
  "presence.guardian_back": {
    en: { title: "Back online", body: "A trusted contact's device is reachable again." },
    vi: { title: "Đã kết nối lại", body: "Máy của người thân đã kết nối trở lại." },
  },
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
  // Params LUÔN đủ khi enqueue (notify.ts): ownerName ("unknown" nếu chưa đặt
  // tên), amount (XLM đã format), recipient (đã rút gọn), hours (số giờ còn
  // lại). KHÔNG chở secret: không token, không challenge_hash, không địa chỉ đầy đủ.
  "approval.requested": {
    en: {
      title: "Your confirmation is needed",
      body: "{ownerName, select, unknown {A family member} other {{ownerName}}} wants to send {amount} XLM to {recipient}. Please review it — the request expires in {hours, plural, one {# hour} other {# hours}}.",
    },
    vi: {
      title: "Cần bạn xác nhận",
      body: "{ownerName, select, unknown {Một người thân} other {{ownerName}}} muốn gửi {amount} XLM tới {recipient}. Nhờ bạn xem giúp — yêu cầu hết hạn sau {hours, plural, other {# giờ}}.",
    },
    zh: {
      title: "需要您确认",
      body: "{ownerName, select, unknown {一位家人} other {{ownerName}}} 想向 {recipient} 转账 {amount} XLM。请尽快查看——该请求将在 {hours, plural, other {# 小时}} 后过期。",
    },
  },
  "approval.approved": {
    en: {
      title: "Transfer confirmed",
      body: "A trusted contact confirmed your transfer. You can now finish it with your face or fingerprint.",
    },
    vi: {
      title: "Khoản chuyển đã được xác nhận",
      body: "Người thân đã xác nhận khoản chuyển của bạn. Giờ bạn có thể hoàn tất bằng khuôn mặt hoặc vân tay.",
    },
    zh: {
      title: "转账已确认",
      body: "家人已确认您的转账。现在您可以用面容或指纹完成付款。",
    },
  },
  "approval.rejected": {
    en: {
      title: "Transfer declined",
      body: "A trusted contact declined your transfer after checking it. No money left your wallet. If you think this is a mistake, talk to them directly.",
    },
    vi: {
      title: "Người thân đã từ chối khoản chuyển",
      body: "Sau khi kiểm tra, người thân đã từ chối khoản chuyển này. Tiền chưa rời ví. Nếu bạn nghĩ có nhầm lẫn, hãy trao đổi trực tiếp với họ.",
    },
    zh: {
      title: "转账被拒绝",
      body: "家人核实后拒绝了这笔转账。资金未离开您的钱包。如有疑问，请直接与家人沟通。",
    },
  },
  // Lô policy 2026-07-29 (B4/B9/B6) — params khi enqueue: perTx + daily (XLM đã
  // format), hours (24), link (URL màn Cài đặt để huỷ — email đi NGOÀI app nên
  // phải tự chở đường về). Không secret, không địa chỉ ví.
  "policy.raise_requested": {
    en: {
      title: "Spending limit increase requested",
      body: "Someone asked to raise this wallet's spending limits to {perTx} XLM per transfer and {daily} XLM per day. The old limits stay in force for {hours, plural, one {# hour} other {# hours}}. If this was NOT you, cancel it now: {link}",
    },
    vi: {
      title: "Có đề nghị nâng hạn mức chi tiêu",
      body: "Có người đề nghị nâng hạn mức ví lên {perTx} XLM mỗi lần chuyển và {daily} XLM mỗi ngày. Hạn mức cũ vẫn hiệu lực trong {hours, plural, other {# giờ}} nữa. Nếu KHÔNG phải bạn, hãy huỷ ngay: {link}",
    },
    zh: {
      title: "有人请求提高消费限额",
      body: "有人请求将此钱包的限额提高到每笔 {perTx} XLM、每天 {daily} XLM。旧限额将在接下来 {hours, plural, other {# 小时}} 内继续生效。如果不是您本人操作，请立即取消：{link}",
    },
  },
  "policy.raise_requested_guardian": {
    en: {
      title: "A wallet you help protect wants higher limits",
      body: "The owner of a wallet you help protect asked to raise its spending limits to {perTx} XLM per transfer and {daily} XLM per day, effective in {hours, plural, one {# hour} other {# hours}}. If they seem unaware of this, call them — they can cancel it anytime before then.",
    },
    vi: {
      title: "Ví bạn đang trông muốn nâng hạn mức",
      body: "Chủ ví mà bạn đang trông giúp vừa đề nghị nâng hạn mức lên {perTx} XLM mỗi lần chuyển và {daily} XLM mỗi ngày, có hiệu lực sau {hours, plural, other {# giờ}}. Nếu họ không biết về việc này, hãy gọi cho họ — họ huỷ được bất cứ lúc nào trước đó.",
    },
    zh: {
      title: "您守护的钱包想提高限额",
      body: "您帮忙守护的钱包的主人请求将限额提高到每笔 {perTx} XLM、每天 {daily} XLM，将在 {hours, plural, other {# 小时}} 后生效。如果对方并不知情，请打电话确认——在生效前他们随时可以取消。",
    },
  },
  "policy.raise_applied": {
    en: {
      title: "New spending limits are now active",
      body: "The waiting period ended and this wallet's spending limits are now {perTx} XLM per transfer and {daily} XLM per day. If this surprises you, lower them in Settings — lowering takes effect immediately.",
    },
    vi: {
      title: "Hạn mức chi tiêu mới đã có hiệu lực",
      body: "Hết thời gian chờ, hạn mức của ví giờ là {perTx} XLM mỗi lần chuyển và {daily} XLM mỗi ngày. Nếu bạn thấy bất ngờ, hãy hạ hạn mức trong Cài đặt — hạ xuống có hiệu lực ngay lập tức.",
    },
    zh: {
      title: "新的消费限额已生效",
      body: "等待期已结束，此钱包的限额现为每笔 {perTx} XLM、每天 {daily} XLM。如果您对此感到意外，请在设置中调低限额——调低会立即生效。",
    },
  },
  "intent.expired": {
    en: {
      title: "Transfer request expired",
      body: "A transfer waiting for family confirmation expired before it was approved. No money left your wallet — you can create it again anytime.",
    },
    vi: {
      title: "Yêu cầu chuyển tiền đã hết hạn",
      body: "Một khoản chuyển chờ người thân xác nhận đã hết hạn trước khi được duyệt. Tiền chưa rời ví — bạn có thể tạo lại bất cứ lúc nào.",
    },
    zh: {
      title: "转账请求已过期",
      body: "一笔等待家人确认的转账在获批前已过期。资金未离开您的钱包——您可以随时重新发起。",
    },
  },
  "approval.expired": {
    en: {
      title: "A request expired",
      body: "A transfer that was waiting for your confirmation has expired. Nothing happened and no money moved — you don't need to do anything.",
    },
    vi: {
      title: "Một yêu cầu đã hết hạn",
      body: "Khoản chuyển chờ bạn xác nhận đã hết hạn. Không có gì xảy ra, tiền không di chuyển — bạn không cần làm gì thêm.",
    },
    zh: {
      title: "一个请求已过期",
      body: "等待您确认的转账已过期。资金没有变动——您无需进行任何操作。",
    },
  },
  "transaction.settled": {
    en: { title: "Money sent", body: "Your transfer is complete and recorded on the network." },
    vi: {
      title: "Đã chuyển tiền",
      body: "Khoản chuyển của bạn đã hoàn tất và được ghi nhận trên mạng lưới.",
    },
  },
  "care.revoked": {
    en: {
      title: "Allowance turned off",
      body: "A spending allowance from this wallet was turned off.",
    },
    vi: {
      title: "Đã tắt khoản chi tiêu được phép",
      body: "Một hạn mức chi tiêu từ ví này đã bị tắt.",
    },
  },
  "inheritance.opened": {
    en: {
      title: "Inheritance process has started",
      body: "The wallet owner has been silent long enough that the inheritance process opened. If the owner is fine, they can stop this at any time.",
    },
    vi: {
      title: "Quy trình thừa kế đã mở",
      body: "Chủ ví im lặng đủ lâu nên quy trình thừa kế đã mở. Nếu chủ ví vẫn ổn, họ có thể dừng lại bất cứ lúc nào.",
    },
  },
  "inheritance.claimed": {
    en: {
      title: "Inheritance claimed",
      body: "The waiting period has ended and the inheritance was claimed.",
    },
    vi: { title: "Đã nhận thừa kế", body: "Thời gian chờ đã hết và phần thừa kế đã được nhận." },
  },
  "heartbeat.reminder": {
    en: {
      title: "Are you still there?",
      body: "You haven't checked in for {days, plural, one {# day} other {# days}}. One tap tells your family everything is fine.",
    },
    vi: {
      title: "Bạn vẫn ổn chứ?",
      body: "Đã {days, plural, other {# ngày}} bạn chưa chạm 'tôi vẫn ổn'. Một chạm để người thân yên tâm.",
    },
  },
  "heartbeat.guardian_check": {
    en: {
      title: "Please check on the wallet owner",
      body: "The wallet owner hasn't responded for a while. Could you reach out and make sure they're okay?",
    },
    vi: {
      title: "Nhờ bạn hỏi thăm chủ ví",
      body: "Chủ ví đã lâu không phản hồi. Bạn hỏi thăm xem họ có ổn không nhé?",
    },
  },
  "inheritance.suggest_claim": {
    en: {
      title: "You may start the inheritance process",
      body: "The owner has been silent past the waiting period. If you believe something happened, you can start the inheritance process — it only proceeds after a further safety delay the owner can still stop.",
    },
    vi: {
      title: "Bạn có thể mở quy trình thừa kế",
      body: "Chủ ví đã im lặng quá thời gian chờ. Nếu bạn tin có chuyện xảy ra, bạn có thể mở quy trình thừa kế — quy trình chỉ tiếp tục sau một khoảng chờ an toàn nữa mà chủ ví vẫn dừng được.",
    },
  },
};
