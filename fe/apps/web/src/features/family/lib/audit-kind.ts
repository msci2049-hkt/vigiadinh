// Sổ hoạt động: `kind` + `payload` của audit_log → chuỗi người thường + chi tiết
// đọc được (LÔ 5, 2026-07-30).
//
// TRƯỚC: màn lịch sử map đúng 8 kind, 26 kind còn lại rơi hết vào câu chung "Hoạt
// động của ví" — cộng thêm họ `unknown:<kind>` mà indexer sinh vô hạn. Người dùng
// mở lịch sử ra thấy ba dòng vô nghĩa giống nhau và không biết tiền mình đi đâu.
//
// LUẬT CHỮ (rule fe/CLAUDE.md §4 + PROJECT-BRIEF §5): câu hiện ra dành cho người
// KHÔNG rành công nghệ. CẤM "intent", "policy", "on-chain", "registry", "settled",
// "guardian", "threshold" trong chuỗi hiển thị. Mã kỹ thuật (mã giao dịch) để
// dòng nhỏ mờ, không nằm trong câu chính.

/** kind audit_log → key i18n. Nhiều kind chung một câu là CỐ Ý: người dùng không
 * cần biết "guardian.approved" (chuỗi duyệt) khác "intent.guardian_approved"
 * (bước duyệt) ở chỗ nào — họ cần biết "một người thân đã xác nhận". */
const KIND_KEYS = {
  // ── Gửi tiền (pipeline lệnh gửi) ──────────────────────────────────────────
  "intent.created": "history.kind.sendRequested",
  "intent.awaiting_guardian": "history.kind.sendWaitingFamily",
  "intent.guardian_approved": "history.kind.familyApproved",
  "intent.guardian_rejected": "history.kind.familyRejected",
  "intent.cancelled": "history.kind.sendCancelled",
  "intent.submit_failed": "history.kind.sendFailed",
  "intent.settled": "history.kind.moneySent",
  "intent.expired": "history.kind.requestExpired",
  "transaction.settled": "history.kind.moneySent",
  "signature.completed": "history.kind.sendSigned",
  "approval.requested": "history.kind.approvalRequested",
  "guardian.approved": "history.kind.familyApproved",
  // ── Hạn mức an toàn của ví ────────────────────────────────────────────────
  "policy.evaluated": "history.kind.limitsChecked",
  "policy.change_applied": "history.kind.limitsChanged",
  "policy.raise_requested": "history.kind.limitsRaiseRequested",
  "policy.raise_cancelled": "history.kind.limitsRaiseCancelled",
  // ── Người thân bảo hộ ─────────────────────────────────────────────────────
  g_add: "history.kind.familyAdded",
  g_remove: "history.kind.familyRemoved",
  "guardian.health_changed": "history.kind.familyConnectionChanged",
  "care.revoked": "history.kind.careRevoked",
  // ── Khôi phục ví ──────────────────────────────────────────────────────────
  register: "history.kind.walletRegistered",
  initiate: "history.kind.recoveryStarted",
  approve: "history.kind.recoveryApproved",
  cancel: "history.kind.recoveryBlocked",
  finalize: "history.kind.recoveryDone",
  "recovery.vetoed": "history.kind.recoveryBlocked",
  // ── Vẫn-còn-đây / thừa kế ─────────────────────────────────────────────────
  heartbeat: "history.kind.checkinSent",
  "heartbeat.received": "history.kind.checkinSent",
  "heartbeat.escalated": "history.kind.checkinMissed",
  inheritance_opened: "history.kind.inheritanceOpened",
  inheritance_claimed: "history.kind.inheritanceClaimed",
  will_hash_anchored: "history.kind.documentAnchored",
  // ── Hệ thống ──────────────────────────────────────────────────────────────
  "indexer.gap": "history.kind.gap",
} as const;

/**
 * `recovery.onchain.submitted` — CÂU ĐÚNG NẰM TRONG PAYLOAD.
 *
 * Sửa cái sai chỗ: dòng 14:21 của ví thật hiện "Một thao tác đã được gửi lên mạng
 * lưới" trong khi nó mô tả `register_wallet` (bật bảo vệ gia đình). Một kind gánh
 * SÁU việc khác nhau, và câu chung chung là câu duy nhất luôn đúng mà không nói gì.
 * `payload.method` có sẵn từ đầu (recovery/features/onchain-actions/service.ts) —
 * chỉ là chưa ai đọc.
 */
const METHOD_KEYS = {
  register_wallet: "history.kind.walletRegistered",
  initiate_recovery: "history.kind.recoveryStarted",
  approve_recovery: "history.kind.recoveryApproved",
  cancel_recovery: "history.kind.recoveryBlocked",
  finalize_recovery: "history.kind.recoveryDone",
  add_guardian: "history.kind.familyAdded",
} as const;

const FALLBACK_KEYS = ["history.kind.actionSubmitted", "history.kind.other"] as const;

export type HistoryKindKey =
  | (typeof KIND_KEYS)[keyof typeof KIND_KEYS]
  | (typeof METHOD_KEYS)[keyof typeof METHOD_KEYS]
  | (typeof FALLBACK_KEYS)[number];

const UNKNOWN_PREFIX = "unknown:";

/** kind (+ payload khi cần) → key i18n. Kind lạ → câu chung, KHÔNG hiện mã thô. */
export function auditKindKey(kind: string, payload?: unknown): HistoryKindKey {
  if (kind === "recovery.onchain.submitted") {
    const method = readString(payload, "method");
    const byMethod = method === null ? undefined : METHOD_KEYS[method as keyof typeof METHOD_KEYS];
    return byMethod ?? "history.kind.actionSubmitted";
  }
  // Indexer ghi kind chưa biết thành `unknown:<kind>` (indexer.service.ts) — bóc
  // vỏ rồi thử lại: kind mới của contract sẽ có câu đúng ngay khi ta thêm vào map,
  // không phải chờ sửa cả đường ghi.
  const bare = kind.startsWith(UNKNOWN_PREFIX) ? kind.slice(UNKNOWN_PREFIX.length) : kind;
  return KIND_KEYS[bare as keyof typeof KIND_KEYS] ?? "history.kind.other";
}

export type AuditStatusKey =
  | "history.detail.statusDone"
  | "history.detail.statusFailed"
  | "history.detail.statusPending";

/** Trạng thái tx của Stellar RPC → chữ người thường. Mã lạ → null (thà không nói
 * gì còn hơn dội "TRY_AGAIN_LATER" vào mặt người dùng). */
const STATUS_KEYS: Record<string, AuditStatusKey> = {
  SUCCESS: "history.detail.statusDone",
  FAILED: "history.detail.statusFailed",
  ERROR: "history.detail.statusFailed",
  PENDING: "history.detail.statusPending",
  NOT_FOUND: "history.detail.statusPending",
  DUPLICATE: "history.detail.statusPending",
  TRY_AGAIN_LATER: "history.detail.statusPending",
};

export type AuditDetails = {
  /** Hash tx 64 hex — CHỈ khi đúng dạng, để không dựng link explorer trỏ vào rác. */
  txHash: string | null;
  statusKey: AuditStatusKey | null;
  /** ScaledAmount (chuỗi stroops) — format ở lá cuối bằng formatAmount. */
  amount: string | null;
  /** Địa chỉ ĐẦY ĐỦ người nhận — rút gọn lúc render, không rút gọn ở đây. */
  recipient: string | null;
};

/** Dòng nhật ký như API trả về — chỉ phần hàm này cần đọc. */
export type AuditRow = {
  payload: unknown;
  amount?: string | null;
  recipient?: string | null;
};

const TX_HASH = /^[0-9a-f]{64}$/i;
const SCALED_AMOUNT = /^[0-9]{1,30}$/;
// Địa chỉ Stellar: 56 ký tự base32 (G… tài khoản, C… hợp đồng, M… muxed). Kiểm
// HÌNH DẠNG thôi, không kiểm checksum: giá trị này do luồng gửi của chính ta ghi
// vào DB sau khi đã validate bằng StrKey, ở đây chỉ cần chắc không render rác.
const STELLAR_ADDRESS = /^[A-Z2-7]{56}$/;

/**
 * Bóc chi tiết đọc được của MỘT dòng nhật ký.
 *
 * Hai nguồn, có lý do: `amount`/`recipient` là trường phẳng do BE join từ
 * `transaction_intents` (B3 — payload không bao giờ chở số tiền), còn hash/status
 * nằm trong `payload` và payload KHÔNG có hợp đồng chung (hành động recovery ghi
 * `hash`, event on-chain ghi `data.txHash`) nên phải đọc theo thứ tự.
 *
 * Mọi trường validate theo hình dạng rồi mới nhận — thiếu hay dị dạng thì trả
 * null, KHÔNG vỡ dòng và KHÔNG hiện chỗ trống.
 */
export function auditDetails(row: AuditRow): AuditDetails {
  const { payload } = row;
  const data = readRecord(payload, "data");
  const rawHash =
    readString(payload, "hash") ?? readString(payload, "txHash") ?? readString(data, "txHash");
  const rawStatus = readString(payload, "status");
  const amount = row.amount ?? null;
  const recipient = row.recipient ?? null;
  return {
    txHash: rawHash !== null && TX_HASH.test(rawHash) ? rawHash : null,
    statusKey: rawStatus === null ? null : (STATUS_KEYS[rawStatus.toUpperCase()] ?? null),
    amount: SCALED_AMOUNT.test(amount ?? "") ? amount : null,
    recipient: STELLAR_ADDRESS.test(recipient ?? "") ? recipient : null,
  };
}

/**
 * Dòng nghĩa là TIỀN ĐÃ RA KHỎI VÍ — chỉ những dòng này được nói "Đã gửi X cho Y".
 *
 * Dòng đang chờ/đã huỷ/gửi lỗi cũng có số tiền (cùng một lệnh gửi), nhưng nói "đã
 * gửi" về chúng là nói sai sự thật về tiền của người ta. Chúng giữ câu theo trạng
 * thái và chở số tiền ở dòng phụ.
 */
export const MONEY_OUT_KEY = "history.kind.moneySent";

/** Mã giao dịch rút gọn cho mắt người — đủ để đối chiếu, không tràn dòng. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function readRecord(source: unknown, key: string): Record<string, unknown> | null {
  if (source === null || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(source: unknown, key: string): string | null {
  if (source === null || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  // Số cũng nhận: BE ép BigInt của ScVal về string nhưng u32 vẫn là number thật.
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.length > 0 ? value : null;
}
