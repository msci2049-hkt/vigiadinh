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
  },
  "approval.requested": {
    en: {
      title: "Your confirmation is needed",
      body: "A transfer from a family wallet is waiting for you to review. It expires in {minutes, plural, one {# minute} other {# minutes}} — please check it soon.",
    },
    vi: {
      title: "Cần bạn xác nhận",
      body: "Một khoản chuyển từ ví gia đình đang chờ bạn xem. Yêu cầu hết hạn sau {minutes, plural, other {# phút}} — bạn xem sớm giúp nhé.",
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
