// Máy trạng thái XÁC NHẬN → KÝ → NỘP của luồng gửi tiền (WP3 fe-smooth).
//
// Hai luật tiền không thương lượng được ở đây:
// 1. CHỐNG KÝ MÙ giữ nguyên fix P0: entry backend dựng được đối chiếu với input
//    CỤC BỘ của màn gửi (không phải echo của BE) NGAY TRƯỚC khi gọi passkey.
// 2. TIMEOUT ≠ THẤT BẠI: mạng đứt SAU khi nộp thì tiền có thể vẫn đi. Trạng thái
//    `unconfirmed` khoá đường gửi lại và tự đối chiếu audit log tới khi có kết
//    quả thật (intent.settled / intent.submit_failed) — không đoán, không cho retry.
//
// Ký passkey inject qua `signEntries` (route wiring `signWalletEntries` của
// features/wallet vào) — feature này KHÔNG import chéo feature khác.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { assertTransferEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";
import { auditOptions } from "../api/audit";
import { confirmSend, type SendReview, signSend } from "../api/send";

export type SendPhase =
  | "idle"
  | "confirming" // BE chạy policy + build + simulate
  | "signing" // hộp thoại sinh trắc học đang mở
  | "submitting" // đã ký — BE nộp + chờ ledger đóng (~5s)
  | "settled" // xong, có hash
  | "awaiting_guardian" // vượt ngưỡng — cần người thân duyệt
  | "unconfirmed" // mạng đứt sau khi nộp — CẤM gửi lại, đang đối chiếu audit
  | "failed"; // lỗi TRƯỚC điểm nộp (an toàn) hoặc BE xác nhận nộp trượt

/** BE xác nhận (qua audit) là nộp TRƯỢT — tiền chưa rời ví, làm lại từ đầu. */
export class DefiniteSubmitFailure extends Error {
  constructor() {
    super("SUBMIT_FAILED_CONFIRMED");
    this.name = "DefiniteSubmitFailure";
  }
}

class SubmitTimeout extends Error {
  constructor() {
    super("SUBMIT_TIMEOUT");
    this.name = "SubmitTimeout";
  }
}

export type SignEntries = (input: {
  entriesXdr: string[];
  latestLedger: number;
}) => Promise<string[]>;

type Timing = { submitTimeoutMs: number; pollEveryMs: number; pollMax: number };
const DEFAULT_TIMING: Timing = { submitTimeoutMs: 30_000, pollEveryMs: 5_000, pollMax: 24 };

/**
 * signSend thất bại kiểu nào thì "có thể đã tới BE"? Không có HTTP response
 * (TypeError của fetch), timeout của ta, hoặc lỗi tầng proxy (502/504/522/524 —
 * BE có thể vẫn đang xử lý phía sau). 500 sạch = handler BE đã chạy nhánh lỗi
 * và ghi submit_failed; 503 = rate-limit chặn TRƯỚC handler — cả hai là chắc chắn.
 */
function maybeReachedChain(err: unknown): boolean {
  if (err instanceof SubmitTimeout) return true;
  if (err instanceof ApiError) return [502, 504, 522, 524].includes(err.status);
  return !(err instanceof BlindSignError);
}

type AuditRow = { kind: string; payload: unknown };

/** Tìm kết cục THẬT của intent trong audit log (BE append khi settle/trượt). */
export function auditVerdict(
  rows: readonly AuditRow[],
  intentId: string,
): { kind: "settled"; hash: string | null } | { kind: "failed" } | null {
  for (const row of rows) {
    const p = row.payload as { intentId?: string; hash?: string } | null;
    if (p?.intentId !== intentId) continue;
    if (row.kind === "intent.settled") return { kind: "settled", hash: p.hash ?? null };
    if (row.kind === "intent.submit_failed") return { kind: "failed" };
  }
  return null;
}

export function useSendMachine(opts: {
  walletId: string | null;
  walletAddress: string | null;
  signEntries: SignEntries;
  /** Chỉ test override — mặc định 30s timeout, poll 5s × 24 lần (~2 phút). */
  timing?: Partial<Timing>;
}) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<SendPhase>("idle");
  const [error, setError] = useState<unknown>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
    };
  }, []);

  const timing: Timing = { ...DEFAULT_TIMING, ...opts.timing };
  // Ref để start() ổn định mà vẫn đọc giá trị mới (test đổi timing giữa chừng không cần).
  const cfg = useRef({ opts, timing });
  cfg.current = { opts, timing };

  const pollAudit = useCallback(
    async (intentId: string, walletId: string) => {
      const { pollEveryMs, pollMax } = cfg.current.timing;
      for (let i = 0; i < pollMax; i += 1) {
        await new Promise((r) => setTimeout(r, pollEveryMs));
        if (disposed.current) return;
        try {
          const rows = await queryClient.fetchQuery({ ...auditOptions(walletId), staleTime: 0 });
          const verdict = auditVerdict(rows, intentId);
          if (verdict?.kind === "settled") {
            setTxHash(verdict.hash);
            setPhase("settled");
            return;
          }
          if (verdict?.kind === "failed") {
            setError(new DefiniteSubmitFailure());
            setPhase("failed");
            return;
          }
        } catch {
          // Mạng còn đứt — giữ trạng thái "đang kiểm tra", thử vòng sau.
        }
      }
      if (!disposed.current) setPollExhausted(true);
    },
    [queryClient],
  );

  const start = useCallback(
    async (review: SendReview, local: { recipient: string; amountStroops: string }) => {
      const { opts: o } = cfg.current;
      setError(null);
      setTxHash(null);
      setPollExhausted(false);
      setPhase("confirming");

      let confirmed: Awaited<ReturnType<typeof confirmSend>>;
      try {
        confirmed = await confirmSend(review.intentId);
      } catch (err) {
        // Chưa có gì được ký/nộp — thất bại ở đây luôn an toàn.
        setError(err);
        setPhase("failed");
        return;
      }
      if (confirmed.status === "awaiting_guardian") {
        setPhase("awaiting_guardian");
        return;
      }

      let signed: string[];
      try {
        // CHỐNG KÝ MÙ (fix P0 — giữ nguyên, chạy cho MỌI đường tới passkey):
        // so entry với thứ NGƯỜI DÙNG nhập ở màn này, không phải echo của BE.
        // Thiếu dữ kiện đối chiếu = CHỐI ký, không "tạm cho qua".
        if (!o.walletAddress) throw new BlindSignError("ENTRY_WRONG_SOURCE");
        if (!env.VITE_SAC_NATIVE) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
        let amount: bigint;
        try {
          amount = BigInt(local.amountStroops);
        } catch {
          throw new BlindSignError("ENTRY_WRONG_AMOUNT");
        }
        for (const entryXdr of confirmed.authEntriesXdr) {
          assertTransferEntry(entryXdr, {
            sac: env.VITE_SAC_NATIVE,
            from: o.walletAddress,
            to: local.recipient,
            amount,
          });
        }
        setPhase("signing");
        signed = await o.signEntries({
          entriesXdr: confirmed.authEntriesXdr,
          latestLedger: confirmed.latestLedger,
        });
      } catch (err) {
        // Guard chặn hoặc người dùng huỷ sinh trắc học — chưa nộp gì, an toàn.
        setError(err);
        setPhase("failed");
        return;
      }

      setPhase("submitting");
      try {
        const settled = await Promise.race([
          signSend({ intentId: review.intentId, signedEntriesXdr: signed }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new SubmitTimeout()), cfg.current.timing.submitTimeoutMs);
          }),
        ]);
        setTxHash(settled.hash);
        setPhase("settled");
      } catch (err) {
        if (maybeReachedChain(err) && o.walletId) {
          // Tiền CÓ THỂ đã đi — không kết luận, không cho gửi lại, đi hỏi audit.
          setPhase("unconfirmed");
          void pollAudit(review.intentId, o.walletId);
          return;
        }
        setError(err);
        setPhase("failed");
      }
    },
    [pollAudit],
  );

  /** Về idle (quay lại form nhập / làm lại từ đầu). KHÔNG gọi được từ unconfirmed
   * đang poll — màn đó không có nút nào dẫn tới đây theo thiết kế. */
  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setTxHash(null);
    setPollExhausted(false);
  }, []);

  /** Cho phép bấm lại CHỈ khi thất bại trước điểm nộp (hoặc BE xác nhận trượt). */
  const canRetry = phase === "failed";
  const busy = phase === "confirming" || phase === "signing" || phase === "submitting";

  return { phase, error, txHash, pollExhausted, canRetry, busy, start, reset };
}
