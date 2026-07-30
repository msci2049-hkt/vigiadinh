// KÝ TIẾP một lệnh đã được người thân duyệt (lô vá L2).
//
// Khác `use-send-machine`: ở đây KHÔNG có bước nhập và KHÔNG có `confirmSend` —
// policy đã chạy, phiếu đã đủ, intent đang đứng ở `awaiting_signature`. Việc còn
// lại đúng ba bước: lấy tx ký được (`getSignable`) → chống ký mù → ký + nộp.
//
// CHỐNG KÝ MÙ Ở ĐƯỜNG NÀY — đọc kỹ trước khi sửa:
// Luật gốc của auth-entry-guard là "so entry với INPUT CỤC BỘ của người dùng,
// không phải giá trị backend echo lại". Đường này không có input cục bộ (lệnh
// được tạo từ phiên trước, có thể trên máy khác). Thứ thay thế: giá trị đem so
// lấy từ danh sách `/pending-signature` — MỘT endpoint KHÁC với `/signable` —
// và chính giá trị đó được RENDER ĐẦY ĐỦ trên màn hình ngay cạnh nút ký. Nên
// bảo đảm ở đây là "thứ bạn ĐANG NHÌN chính là thứ bạn ký", yếu hơn "thứ bạn
// vừa GÕ chính là thứ bạn ký" của luồng gửi mới — một BE bị chiếm hoàn toàn nói
// dối được cả hai endpoint. Đổi lại nó vẫn chặn đứng ca tráo entry ở bước
// `/signable` (đường tấn công rẻ nhất) và vẫn tốt hơn vô hạn so với hiện trạng
// "không có đường ký nào cả". Ghi rõ ở threat model, đừng âm thầm hạ chuẩn thêm.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getSignable, signSend } from "@/features/family/api/send";
import { assertTransferEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";
import type { SignEntries } from "./use-send-machine";

export type ResumePhase = "idle" | "preparing" | "signing" | "submitting" | "settled" | "failed";

export type ResumeTarget = {
  intentId: string;
  /** Ví nguồn — phải là giá trị ĐANG HIỆN trên màn, không phải của /signable. */
  from: string;
  recipient: string | null;
  amountStroops: string | null;
};

export function useResumeSigning(opts: { signEntries: SignEntries }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<ResumePhase>("idle");
  const [error, setError] = useState<unknown>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);

  const run = useCallback(
    async (target: ResumeTarget) => {
      setError(null);
      setTxHash(null);
      setActiveIntentId(target.intentId);
      setPhase("preparing");

      let signed: string[];
      let latestLedger: number;
      try {
        const built = await getSignable(target.intentId);
        // Thiếu bất kỳ dữ kiện đối chiếu nào = CHỐI ký, không "tạm cho qua".
        if (!env.VITE_SAC_NATIVE) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
        if (!target.recipient) throw new BlindSignError("ENTRY_WRONG_RECIPIENT");
        if (!target.amountStroops) throw new BlindSignError("ENTRY_WRONG_AMOUNT");
        let amount: bigint;
        try {
          amount = BigInt(target.amountStroops);
        } catch {
          throw new BlindSignError("ENTRY_WRONG_AMOUNT");
        }
        for (const entryXdr of built.authEntriesXdr) {
          assertTransferEntry(entryXdr, {
            sac: env.VITE_SAC_NATIVE,
            from: target.from,
            to: target.recipient,
            amount,
          });
        }
        latestLedger = built.latestLedger;
        setPhase("signing");
        signed = await opts.signEntries({ entriesXdr: built.authEntriesXdr, latestLedger });
      } catch (err) {
        // Guard chặn / người dùng huỷ sinh trắc học / lệnh vừa hết hạn — chưa
        // nộp gì lên mạng, dừng ở đây là an toàn tuyệt đối.
        setError(err);
        setPhase("failed");
        return;
      }

      setPhase("submitting");
      try {
        const settled = await signSend({
          intentId: target.intentId,
          signedEntriesXdr: signed,
        });
        setTxHash(settled.hash);
        setPhase("settled");
      } catch (err) {
        // KHÔNG có nhánh "unconfirmed" ở đây như luồng gửi mới: lệnh vẫn nằm
        // trong danh sách chờ ký nếu chưa đi, và biến mất khỏi đó khi đã đi.
        // Danh sách CHÍNH LÀ nguồn sự thật — refetch rồi để người dùng nhìn.
        setError(err);
        setPhase("failed");
      } finally {
        void queryClient.invalidateQueries({ queryKey: ["family"] });
      }
    },
    [opts.signEntries, queryClient],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setTxHash(null);
    setActiveIntentId(null);
  }, []);

  const busy = phase === "preparing" || phase === "signing" || phase === "submitting";
  return { phase, error, txHash, activeIntentId, busy, run, reset };
}
