// Tín hiệu rủi ro quanh MỘT lệnh chuyển (lô R2) — GET /api/intents/:id/signals.
// Số liệu deterministic từ SQL (lớp 2), KHÔNG LLM, KHÔNG số dư. Cả hai màn
// (guardian duyệt, chủ ví chờ duyệt) đọc chung endpoint này.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type IntentSignals = {
  /** Stroops, chuỗi (bigint-safe). */
  amount: string;
  /** Đủ 56 ký tự. */
  recipient: string;
  /** Gấp mấy lần mức thường ngày 30 ngày — null khi ví chưa đủ 3 lệnh settled. */
  ratioToAvg: number | null;
  /** 0 = địa chỉ LẠ (lần đầu ví gửi tới). */
  recipientSettledCount: number;
  txCountLastHour: number;
  /** Tổng stroops 1 giờ qua, chuỗi. */
  totalLastHour: string;
  policyOutcome: "direct" | "awaiting_guardian";
  requiresGuardian: boolean;
};

export const intentSignalsKeys = {
  all: ["family", "intent-signals"] as const,
  detail: (intentId: string) => [...intentSignalsKeys.all, intentId] as const,
};

export const intentSignalsOptions = (intentId: string) =>
  queryOptions({
    queryKey: intentSignalsKeys.detail(intentId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: IntentSignals }>(`/api/intents/${intentId}/signals`);
      return res.data;
    },
  });
