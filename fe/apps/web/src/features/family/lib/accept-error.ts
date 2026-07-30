// Dịch lỗi của bước "nhận lời mời làm người bảo hộ" — THUẦN, test hermetic.
//
// Cùng bệnh với đường gửi tiền: bước này gộp MỌI thất bại vào một câu chung
// ("Chưa tải được mục này. Kéo để làm mới hoặc thử lại sau ít phút.") trong khi
// bốn nguyên nhân dưới đây đòi bốn hành động HOÀN TOÀN KHÁC NHAU —
// đăng nhập lại · xin link mới · thôi (đã dùng rồi) · tạo lại passkey.
//
// Lưu ý về 401: `apiClient` tự đá sang /login khi gặp 401 (giữ ?token qua
// ?redirect), nên nhánh errSignedOut thường không kịp hiện. Vẫn map để lưới không
// thủng khi phiên chết ở bước khác (vd chưa kịp redirect).
import { ApiError } from "@/lib/api-client";

export type AcceptErrorKey =
  | "guardians.accept.errSignedOutTitle"
  | "guardians.accept.errSignedOutBody"
  | "guardians.accept.errGoneTitle"
  | "guardians.accept.errGoneBody"
  | "guardians.accept.errTakenTitle"
  | "guardians.accept.errTakenBody"
  | "guardians.accept.errIdentityTitle"
  | "guardians.accept.errIdentityBody"
  | "guardians.accept.errBusyTitle"
  | "guardians.accept.errBusyBody"
  | "guardians.accept.errGenericTitle"
  | "guardians.accept.errGenericBody"
  | "guardians.accept.selfTitle"
  | "guardians.accept.selfBody"
  | "guardians.accept.errAlreadyGuardianTitle"
  | "guardians.accept.errAlreadyGuardianBody";

export type AcceptErrorView = {
  title: AcceptErrorKey;
  body: AcceptErrorKey;
  /** Lối thoát duy nhất cần nút riêng — các ca khác đọc câu là biết làm gì. */
  action: "login" | null;
  /** Mã kỹ thuật, CHỈ khi không map được. */
  code?: string;
};

const SIGNED_OUT: AcceptErrorView = {
  title: "guardians.accept.errSignedOutTitle",
  body: "guardians.accept.errSignedOutBody",
  action: "login",
};

const BY_CODE: Record<string, AcceptErrorView> = {
  UNAUTHENTICATED: SIGNED_OUT,
  WALLET_SESSION_REVOKED: SIGNED_OUT,
  INVITE_NOT_FOUND: {
    title: "guardians.accept.errGoneTitle",
    body: "guardians.accept.errGoneBody",
    action: null,
  },
  INVITE_NOT_USABLE: {
    title: "guardians.accept.errGoneTitle",
    body: "guardians.accept.errGoneBody",
    action: null,
  },
  INVITE_ALREADY_ACCEPTED: {
    title: "guardians.accept.errTakenTitle",
    body: "guardians.accept.errTakenBody",
    action: null,
  },
  // Chủ ví tự bấm nhận lời của chính mình — câu tử tế đã có sẵn từ trước.
  GUARDIAN_IS_OWNER: {
    title: "guardians.accept.selfTitle",
    body: "guardians.accept.selfBody",
    action: null,
  },
  // MỘT NGƯỜI MỘT GHẾ (BE chặn từ lô 30/07): người này đã bảo hộ ví rồi —
  // việc tiếp theo là CHUYỂN link cho người thân khác, không phải "thử lại".
  GUARDIAN_ALREADY_GUARDIAN: {
    title: "guardians.accept.errAlreadyGuardianTitle",
    body: "guardians.accept.errAlreadyGuardianBody",
    action: null,
  },
  RATE_LIMITED: {
    title: "guardians.accept.errBusyTitle",
    body: "guardians.accept.errBusyBody",
    action: null,
  },
  RATE_LIMIT_STORE_DOWN: {
    title: "guardians.accept.errBusyTitle",
    body: "guardians.accept.errBusyBody",
    action: null,
  },
};

const GENERIC: AcceptErrorView = {
  title: "guardians.accept.errGenericTitle",
  body: "guardians.accept.errGenericBody",
  action: null,
};

/** Hỏng ở MÁY NÀY (passkey bị huỷ, thiếu cấu hình ví, deploy không ra địa chỉ). */
const LOCAL: AcceptErrorView = {
  title: "guardians.accept.errIdentityTitle",
  body: "guardians.accept.errIdentityBody",
  action: null,
};

/** Lỗi bất kỳ của bước nhận lời → một câu riêng + (nếu cần) một lối thoát. */
export function mapAcceptError(err: unknown): AcceptErrorView {
  // Không phải lỗi HTTP = hỏng ngay trên máy này (passkey huỷ / thiếu cấu hình).
  if (!(err instanceof ApiError)) return LOCAL;
  const data = err.data as { error?: { code?: string; message?: string } } | null;
  const raw = data?.error?.code ?? data?.error?.message ?? "";
  const head = raw.split(":")[0] ?? "";
  const mapped = BY_CODE[head];
  if (mapped) return mapped;
  if (err.status === 401) return SIGNED_OUT;
  return head ? { ...GENERIC, code: head } : GENERIC;
}
