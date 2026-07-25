// Giải mã giá trị view của registry — THUẦN, test hermetic.
//
// `scValToNative` trả struct contract thành object thường và enum không payload
// thành CHUỖI tên biến thể ("Pending"/"Approved"/…). Không tin mù hình dạng đó:
// contract có thể đổi, và đọc nhầm ở màn veto nghĩa là người dùng không thấy
// thứ họ cần chặn.

export type OnchainRecoveryStatus = "pending" | "approved" | "finalized" | "cancelled";

export type ChainWalletConfig = {
  guardians: string[];
  threshold: number;
  timelockSecs: number;
};

export type ChainRecoveryRequest = {
  status: OnchainRecoveryStatus;
  approvals: string[];
  startedAt: number;
  /** Giây còn lại tới khi finalize được. 0 = hết thời gian chặn. */
  timelockRemainingSecs: number;
};

/**
 * Cửa sổ BẢO VỆ sau khi khôi phục xoay khoá: ví chối MỌI chữ ký (kể cả khoá
 * mới) cho tới khi hết. Đây là HÀNH VI ĐÚNG — chống kẻ vừa chiếm được đợt khôi
 * phục rút tiền ngay. Nhưng người vừa cứu được ví mà thấy "ví bị khoá" không
 * lời giải thích thì đó là khoảnh khắc lo lắng nhất của cả sản phẩm, nên số
 * liệu này phải đọc được để UI nói rõ còn bao lâu.
 */
export type ChainCooldown = {
  active: boolean;
  /** Unix giây — thời điểm hết bảo vệ. null = chưa từng khôi phục. */
  activeUntil: number | null;
  cooldownSecs: number;
};

export type ChainTruth = {
  registered: boolean;
  config: ChainWalletConfig | null;
  request: ChainRecoveryRequest | null;
  cooldown: ChainCooldown;
};

export class ChainShapeError extends Error {}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new ChainShapeError("EXPECTED_OBJECT");
  }
  return value as Record<string, unknown>;
}

/** bigint (u64/i128 của chain) hoặc number → number giây. */
function asSeconds(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  throw new ChainShapeError("EXPECTED_NUMERIC");
}

export function parseWalletConfig(value: unknown): ChainWalletConfig {
  const raw = asRecord(value);
  const guardians = raw.guardians;
  if (!Array.isArray(guardians)) throw new ChainShapeError("EXPECTED_GUARDIAN_LIST");
  const threshold = raw.threshold;
  if (typeof threshold !== "number") throw new ChainShapeError("EXPECTED_THRESHOLD");
  return {
    guardians: guardians.map(String),
    threshold,
    timelockSecs: asSeconds(raw.timelock_secs),
  };
}

const STATUS_MAP: Record<string, OnchainRecoveryStatus> = {
  Pending: "pending",
  Approved: "approved",
  Finalized: "finalized",
  Cancelled: "cancelled",
};

export function parseRecoveryStatus(
  value: unknown,
  timelockRemaining: unknown,
): ChainRecoveryRequest {
  const raw = asRecord(value);
  const statusRaw = raw.status;
  const status = typeof statusRaw === "string" ? STATUS_MAP[statusRaw] : undefined;
  if (!status) throw new ChainShapeError("UNKNOWN_STATUS");
  const approvals = Array.isArray(raw.approvals) ? raw.approvals.map(String) : [];
  return {
    status,
    approvals,
    startedAt: asSeconds(raw.started_at),
    timelockRemainingSecs: asSeconds(timelockRemaining),
  };
}

/**
 * Ghép `last_rotation()` + cooldown từ `get_recovery_registry()` của VÍ.
 * `nowSecs` truyền vào (không đọc đồng hồ trong hàm) để test được.
 */
export function parseCooldown(input: {
  lastRotation: unknown;
  registryLink: unknown;
  nowSecs: number;
}): ChainCooldown {
  // Chưa từng xoay khoá → không có cửa sổ bảo vệ nào.
  if (input.lastRotation === null || input.lastRotation === undefined) {
    return { active: false, activeUntil: null, cooldownSecs: 0 };
  }
  const last = asSeconds(input.lastRotation);
  // `get_recovery_registry()` trả Option<(Address, u64)> → [address, secs] | null.
  const link = input.registryLink;
  const cooldownSecs = Array.isArray(link) && link.length === 2 ? asSeconds(link[1]) : 0;
  const activeUntil = last + cooldownSecs;
  return { active: input.nowSecs < activeUntil, activeUntil, cooldownSecs };
}

/**
 * So chain với mirror. Lệch → **tin chain** và bảo FE hiện "đang đồng bộ".
 * Mirror trễ là chuyện bình thường (indexer poll 30s); mirror SAI hướng —
 * chain đang mở mà mirror nói không có gì — là chuyện nguy hiểm.
 */
export function mirrorDisagrees(input: { chainOpen: boolean; mirrorOpen: boolean }): boolean {
  return input.chainOpen !== input.mirrorOpen;
}
