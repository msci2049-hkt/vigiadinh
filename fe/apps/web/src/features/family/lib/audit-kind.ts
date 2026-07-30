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
};

const TX_HASH = /^[0-9a-f]{64}$/i;
const SCALED_AMOUNT = /^[0-9]{1,30}$/;

/**
 * Bóc chi tiết đọc được ra khỏi payload jsonb. Payload KHÔNG có hợp đồng chung
 * (mỗi nguồn ghi một kiểu: hành động recovery ghi `hash`, lệnh gửi ghi `hash`,
 * event on-chain ghi `data.txHash`) nên đọc theo thứ tự rồi validate hình dạng —
 * thiếu trường nào thì thôi trường đó, KHÔNG vỡ dòng.
 */
export function auditDetails(payload: unknown): AuditDetails {
  const data = readRecord(payload, "data");
  const rawHash =
    readString(payload, "hash") ?? readString(payload, "txHash") ?? readString(data, "txHash");
  const rawStatus = readString(payload, "status");
  const rawAmount = readString(payload, "amount");
  return {
    txHash: rawHash !== null && TX_HASH.test(rawHash) ? rawHash : null,
    statusKey: rawStatus === null ? null : (STATUS_KEYS[rawStatus.toUpperCase()] ?? null),
    amount: rawAmount !== null && SCALED_AMOUNT.test(rawAmount) ? rawAmount : null,
  };
}

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
