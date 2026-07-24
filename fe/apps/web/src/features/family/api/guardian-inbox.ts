// Hộp thư guardian (PHA 6 cụm GHI) — GET /api/recovery/guardian: yêu cầu khôi
// phục ĐANG MỞ trên các ví user đang bảo hộ. Mirror chỉ-đọc (indexer ghi);
// phiếu thật đi đường build/approve + submit với chữ ký của guardian.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RecoveryRequest } from "./recovery";

export type GuardianInboxItem = {
  request: RecoveryRequest;
  wallet: { id: string; stellarAddress: string; threshold: number; timelockSecs: number };
};

export const guardianInboxKeys = {
  all: ["family", "guardian-inbox"] as const,
};

export const guardianInboxOptions = queryOptions({
  queryKey: guardianInboxKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: GuardianInboxItem[] }>("/api/recovery/guardian");
    return res.data;
  },
});
