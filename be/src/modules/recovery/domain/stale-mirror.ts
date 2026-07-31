// Lô R7 — MỘT dòng mirror `pending`/`ready` còn sống hay đã chết? THUẦN, hermetic.
//
// Vì sao luật này phải nằm riêng một chỗ và phải thuần: đánh dấu nhầm `expired`
// nghĩa là XOÁ một yêu cầu khôi phục THẬT khỏi hộp thư người bảo hộ, đúng lúc
// một người đang mất máy cần họ bấm duyệt. Sai ở đây tốn của ai đó cả cái ví,
// nên nó phải test được mà không cần chain, không cần DB, không cần đồng hồ.
//
// Nguyên tắc: chỉ dọn khi chain trả lời DỨT KHOÁT. Mọi thứ khác — mạng chập,
// RPC 5xx, timeout, mã lỗi lạ, shape lạ — là KHÔNG BIẾT, và không biết thì
// KHÔNG ĐỤNG. Mirror thừa một dòng ma là phiền; mirror thiếu một dòng thật là
// mất ví.
import { contractErrorCode } from "./onchain";

/** Hai trường DUY NHẤT mà luật dưới đây cần biết về một yêu cầu on-chain. */
export type ChainRequestFacts = { status: string; expiresAt: number | null };

/** Câu trả lời của chain cho MỘT ví, sau khi đã phân loại lỗi. */
export type ChainVerdict<T extends ChainRequestFacts = ChainRequestFacts> =
  | { kind: "no-request" }
  | { kind: "unreadable" }
  | { kind: "request"; request: T };

/**
 * Lỗi khi đọc `get_recovery_status` → chain nói KHÔNG CÓ, hay ta không đọc được?
 *
 * CHỈ `Error(Contract, #8)` (`NoActiveRecovery`) là câu trả lời dứt khoát: contract
 * đã chạy, đã tra sổ, và sổ trống. Mọi lỗi khác đều là mù — kể cả mã contract khác,
 * vì mã lạ nghĩa là ta chưa hiểu chuyện gì đang xảy ra.
 *
 * Trước lô R7 hai loại này rơi vào cùng một `catch {}` rỗng
 * (`be/src/jobs/recovery-watch.ts:101-104`), nên không có cách nào dựng fail-safe.
 */
export function classifyReadFailure(err: unknown): "no-request" | "unreadable" {
  const message = err instanceof Error ? err.message : "";
  return contractErrorCode(message) === "CONTRACT_ERROR:NoActiveRecovery"
    ? "no-request"
    : "unreadable";
}

/**
 * Được phép chuyển dòng mirror `pending`/`ready` sang `'expired'` không?
 *
 * `true` CHỈ với ba câu trả lời dứt khoát:
 *   (a) contract panic `NoActiveRecovery` — ví này không có yêu cầu nào trong sổ;
 *   (b) chain nói `Cancelled`/`Finalized` — yêu cầu đã đóng rồi;
 *   (c) chain nói `Pending`/`Approved` NHƯNG đã quá `expires_at` — chết vì hết giờ.
 *       Đây là ca mà "chain không có yêu cầu" không bao giờ bắt được, vì
 *       `get_recovery_status` không lọc hết hạn (xem `chain-truth/domain.ts`).
 *
 * `false` với mọi thứ còn lại, đặc biệt `unreadable` và `expiresAt === null`.
 */
export function chainSaysRequestIsDead(verdict: ChainVerdict, nowSecs: number): boolean {
  switch (verdict.kind) {
    // (a)
    case "no-request":
      return true;
    // 🔴 Không đọc được chain = KHÔNG kết luận gì. Đây là dòng giữ cho cả cơ chế
    // này an toàn — bỏ nó đi thì một lần RPC chập là quét sạch mirror.
    case "unreadable":
      return false;
    case "request": {
      const { status, expiresAt } = verdict.request;
      // (b)
      if (status === "cancelled" || status === "finalized") return true;
      // (c) — không có mốc hết hạn thì KHÔNG BIẾT, không phải "chưa hết hạn".
      if (expiresAt === null) return false;
      return nowSecs > expiresAt;
    }
  }
}
