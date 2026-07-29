// Dịch lỗi của đường GỬI TIỀN sang tiếng người — THUẦN, test hermetic.
//
// Sự cố 29/07 là bài học đắt: BE trả `403 WALLET_NOT_REGISTERED_FOR_SPONSORSHIP`
// — mã máy đọc được, đúng nguyên nhân, có sẵn trong body — còn FE gộp MỌI lỗi 4xx
// vào một câu "Chưa có gì được gửi đi. Bạn có thể thử lại an toàn." Người dùng thử
// lại đúng như câu đó bảo, và hỏng y hệt, mãi mãi. Mất một giờ đọc log VPS mới ra.
//
// Luật của bảng này: mỗi nguyên nhân MỘT câu, và mỗi câu phải trả lời đủ ba điều —
// CHẶN VÌ GÌ · ĐỂ BẢO VỆ CÁI GÌ · GIỜ LÀM GÌ. `action` chính là vế thứ ba: lỗi mà
// không có lối đi tiếp là ngõ cụt, người dùng chỉ còn cách bỏ app.
//
// Mã LẠ (chưa map) vẫn rơi về câu chung — nhưng KÈM mã kỹ thuật hiện dòng nhỏ, để
// lần sau không ai phải mò log một giờ nữa.
//
// Key viết NGUYÊN VĂN (không ghép chuỗi): `t()` của repo này type-safe theo catalog
// vi, ghép template là mất kiểm tra chính tả key ở compile time.
import type { ApiError } from "@/lib/api-client";

export type SendErrorKey =
  | "wallet.send.errors.insufficient"
  | "wallet.send.errors.badRecipient"
  | "wallet.send.errors.badAmountTitle"
  | "wallet.send.errors.badAmountBody"
  | "wallet.send.errors.delayed"
  | "wallet.send.errors.walletLocked"
  | "wallet.send.errors.network"
  | "wallet.send.errors.tampered"
  | "wallet.send.errors.spendingLimit"
  | "wallet.send.errors.notSent"
  | "wallet.send.errors.notProtectedTitle"
  | "wallet.send.errors.notProtectedBody"
  | "wallet.send.errors.checkUnavailableTitle"
  | "wallet.send.errors.checkUnavailableBody"
  | "wallet.send.errors.notOwnerTitle"
  | "wallet.send.errors.notOwnerBody"
  | "wallet.send.errors.notGuardianTitle"
  | "wallet.send.errors.notGuardianBody"
  | "wallet.send.errors.rateLimitedTitle"
  | "wallet.send.errors.rateLimitedBody"
  | "wallet.send.errors.staleIntentTitle"
  | "wallet.send.errors.staleIntentBody";

/** Lối thoát gắn kèm câu lỗi. `null` = câu đã tự nói phải làm gì (chờ rồi thử lại). */
export type SendErrorAction =
  /** Ví chưa được bảo vệ → mời người thân / hoàn tất đăng ký (màn tự chọn đích). */
  | "protect"
  /** Vượt hạn mức của ví → Cài đặt ▸ An toàn. */
  | "safety"
  /** Lệnh đã cũ, không dùng lại được → làm lại từ đầu. */
  | "startOver"
  | null;

export type SendErrorView = {
  /** Key i18n cho TIÊU ĐỀ banner. */
  title: SendErrorKey;
  /** Key i18n cho phần giải thích (vì sao · bảo vệ gì · làm gì). */
  body?: SendErrorKey;
  /** Chỉ INSUFFICIENT_BALANCE — số tiền còn thiếu, BE gửi kèm. */
  shortfall?: string;
  action: SendErrorAction;
  /** Mã kỹ thuật — CHỈ set khi không map được, hiện dòng nhỏ mờ để còn debug. */
  code?: string;
};

/** Câu chung cuối cùng — giữ nguyên câu trấn an "chưa có gì được gửi đi". */
export const SEND_FALLBACK: SendErrorView = { title: "wallet.send.errors.notSent", action: null };

const STALE: SendErrorView = {
  title: "wallet.send.errors.staleIntentTitle",
  body: "wallet.send.errors.staleIntentBody",
  action: "startOver",
};

const BAD_INPUT: SendErrorView = {
  title: "wallet.send.errors.badAmountTitle",
  body: "wallet.send.errors.badAmountBody",
  action: null,
};

const TOO_FAST: SendErrorView = {
  title: "wallet.send.errors.rateLimitedTitle",
  body: "wallet.send.errors.rateLimitedBody",
  action: null,
};

const NETWORK: SendErrorView = { title: "wallet.send.errors.network", action: null };

/**
 * Mã BE → câu người đọc. Khoá là phần TRƯỚC dấu ":" của `error.code`
 * (BE gửi dạng `INVALID_TRANSITION:review:owner:sign`, `INSUFFICIENT_BALANCE:{…}`).
 */
const BY_CODE: Record<string, SendErrorView> = {
  // ── Ví chưa được bảo vệ: hàng rào ví phí (B-SEC-3) chối trả gas ────────────
  WALLET_NOT_REGISTERED_FOR_SPONSORSHIP: {
    title: "wallet.send.errors.notProtectedTitle",
    body: "wallet.send.errors.notProtectedBody",
    action: "protect",
  },
  SPONSORSHIP_CHECK_UNAVAILABLE: {
    title: "wallet.send.errors.checkUnavailableTitle",
    body: "wallet.send.errors.checkUnavailableBody",
    action: null,
  },
  // ── Sai người ─────────────────────────────────────────────────────────────
  NOT_OWNER: {
    title: "wallet.send.errors.notOwnerTitle",
    body: "wallet.send.errors.notOwnerBody",
    action: null,
  },
  NOT_GUARDIAN_OF_INTENT: {
    title: "wallet.send.errors.notGuardianTitle",
    body: "wallet.send.errors.notGuardianBody",
    action: null,
  },
  // ── Chính sách chi tiêu ───────────────────────────────────────────────────
  SPENDING_LIMIT_EXCEEDED: { title: "wallet.send.errors.spendingLimit", action: "safety" },
  POLICY_DELAY: { title: "wallet.send.errors.delayed", action: null },
  // ── Nhập sai ──────────────────────────────────────────────────────────────
  BAD_RECIPIENT: { title: "wallet.send.errors.badRecipient", action: null },
  SELF_TRANSFER: { title: "wallet.send.errors.badRecipient", action: null },
  BAD_AMOUNT: BAD_INPUT,
  VALIDATION_ERROR: BAD_INPUT,
  // ── Bấm quá nhanh (writeLimit 10 điểm/60s dùng chung prepare+confirm+sign) ─
  RATE_LIMITED: TOO_FAST,
  RATE_LIMIT_STORE_DOWN: TOO_FAST,
  // ── Lệnh đã đi qua một bước, không dùng lại được ──────────────────────────
  // Bẫy THẬT: màn xác nhận bấm lại là gửi LẠI cùng intent_id, mà state machine
  // chỉ cho `review → policy_gate` MỘT lần. Không có câu riêng thì mọi lần bấm
  // lại đều ra câu chung, và người dùng bấm mãi không hiểu vì sao.
  INVALID_TRANSITION: STALE,
  INTENT_NOT_FOUND: STALE,
  NOT_A_TRANSFER: STALE,
  APPROVAL_BINDING_MISMATCH: STALE,
  WALLET_NOT_FOUND: STALE,
  // ── Hạ tầng: nói "mạng", đừng bắt người dùng đoán ─────────────────────────
  SEND_NOT_CONFIGURED: NETWORK,
  FEE_WALLET_NOT_CONFIGURED: NETWORK,
  STELLAR_UNAVAILABLE: NETWORK,
  CHAIN_NOT_CONFIGURED: NETWORK,
};

/** Lấy mã BE từ body lỗi. Envelope duy nhất của app: `{error:{code,message}}`. */
export function apiErrorCode(err: ApiError): string {
  const data = err.data as { error?: { code?: string; message?: string } } | null;
  return data?.error?.code ?? data?.error?.message ?? "";
}

/** Dịch MỘT ApiError của đường gửi. Lỗi không phải HTTP thì màn tự xử (send.tsx). */
export function mapSendApiError(err: ApiError): SendErrorView {
  const raw = apiErrorCode(err);
  const head = raw.split(":")[0] ?? "";

  if (head === "INSUFFICIENT_BALANCE") {
    // `INSUFFICIENT_BALANCE:{"shortfall":"…"}` — thiếu/hỏng JSON vẫn ra câu đúng.
    try {
      const detail = JSON.parse(raw.slice(raw.indexOf(":") + 1)) as { shortfall?: string };
      if (detail.shortfall) {
        return {
          title: "wallet.send.errors.insufficient",
          action: null,
          shortfall: detail.shortfall,
        };
      }
    } catch {
      // rơi xuống câu không kèm số
    }
    return { title: "wallet.send.errors.insufficient", action: null };
  }

  const mapped = BY_CODE[head];
  if (mapped) return mapped;

  // 5xx = sự cố phía chúng tôi, không phải lỗi người dùng → câu "mạng".
  if (err.status >= 500) return NETWORK;

  // Chưa map: câu chung + MÃ để lần sau debug trong 30 giây, không phải 1 giờ.
  return head ? { ...SEND_FALLBACK, code: head } : SEND_FALLBACK;
}
