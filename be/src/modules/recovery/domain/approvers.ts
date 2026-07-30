// Đọc danh sách NGƯỜI ĐÃ DUYỆT từ recovery_requests.signals (jsonb, indexer ghi
// từ THAM SỐ event on-chain — initiate.value[0] / approve.value[0]). Dữ liệu này
// vốn public trên chain (event registry ai cũng đọc được) nên trả qua cửa public
// được; source account (ví phí) KHÔNG bao giờ xuất hiện ở đây.
export type RecoveryApprover = { guardian: string; txHash: string | null };

/** Shape cửa public /public/progress — CHỈ trường vô hại, vốn public on-chain. */
export type PublicRecoveryProgress = {
  status: string;
  approvals: number;
  threshold: number | null;
  vetoUntil: string | null;
  startedAt: string;
  approvers: RecoveryApprover[];
};

const ADDRESS_RE = /^[GC][A-Z2-7]{55}$/;
const TX_HASH_RE = /^[0-9a-f]{64}$/;

export function approversFromSignals(signals: unknown): RecoveryApprover[] {
  if (typeof signals !== "object" || signals === null) return [];
  const list = (signals as { approvers?: unknown }).approvers;
  if (!Array.isArray(list)) return [];
  const out: RecoveryApprover[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const guardian = (item as { guardian?: unknown }).guardian;
    const txHash = (item as { txHash?: unknown }).txHash;
    if (typeof guardian !== "string" || !ADDRESS_RE.test(guardian)) continue;
    out.push({
      guardian,
      txHash: typeof txHash === "string" && TX_HASH_RE.test(txHash) ? txHash : null,
    });
  }
  return out;
}
