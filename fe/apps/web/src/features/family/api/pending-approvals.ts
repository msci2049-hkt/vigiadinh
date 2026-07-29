// Hộp phiếu chờ duyệt của GUARDIAN (LÔ 1 A5) — GET /api/intents/pending-approvals.
// BE chỉ trả cột an toàn (khoá bằng key-list test pendingApprovalView): KHÔNG có
// challenge_hash, KHÔNG địa chỉ đầy đủ, KHÔNG số dư. amount = chuỗi stroops.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type PendingApproval = {
  approval_id: string;
  intent_id: string;
  wallet_id: string;
  owner_name: string | null;
  amount: string | null;
  recipient_short: string;
  reasons: string[];
  expires_at: string;
};

export const pendingApprovalsKeys = { all: ["family", "pending-approvals"] as const };

export const pendingApprovalsOptions = queryOptions({
  queryKey: pendingApprovalsKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: PendingApproval[] }>("/api/intents/pending-approvals");
    return res.data;
  },
});

/** Guardian quyết — approve mở khoá bước ký của chủ ví, reject dừng lệnh.
 * Cả hai KHÔNG phải chữ ký on-chain (nợ S1 đã ghi): bản ghi off-chain + K5 binding BE. */
export async function decideIntentApproval(input: {
  intentId: string;
  decision: "approved" | "rejected";
  verifiedCall: boolean;
}): Promise<{ nextStatus: string }> {
  const res = await apiClient.post<{ data: { nextStatus: string } }>(
    "/api/intents/send/guardian-approve",
    { intent_id: input.intentId, verified_call: input.verifiedCall, decision: input.decision },
  );
  return res.data;
}
