// Hộp thư guardian (PHA 6 cụm GHI) — GET /api/recovery/guardian: yêu cầu khôi
// phục ĐANG MỞ trên các ví user đang bảo hộ. Mirror chỉ-đọc (indexer ghi);
// phiếu thật đi đường build/approve + submit với chữ ký của guardian.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RecoveryRequest } from "./recovery";

export type GuardianInboxItem = {
  request: RecoveryRequest;
  wallet: { id: string; stellarAddress: string; threshold: number; timelockSecs: number };
  /** R6 — NGƯỜI ĐANG XEM đã bỏ phiếu chưa. BE tính (chỉ BE biết khoá on-chain
   * của người đang xem: cửa trả `onchain_key` là owner-only). Thiếu trường này
   * thì màn ký sáng đèn cho cả người đã ký và họ chạm vân tay rồi mới ăn
   * `AlreadyApproved`. Optional để bản FE mới không vỡ trước bản BE cũ. */
  viewerApproved?: boolean;
};

export const guardianInboxKeys = {
  all: ["family", "guardian-inbox"] as const,
  deviceRequests: ["family", "guardian-inbox", "device-requests"] as const,
};

export const guardianInboxOptions = queryOptions({
  queryKey: guardianInboxKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: GuardianInboxItem[] }>("/api/recovery/guardian");
    return res.data;
  },
  // LÔ 3: lưới đỡ khi SSE hỏng — quay lại tab là tự cập nhật.
  refetchOnWindowFocus: true,
});

/** "Tiếng gõ cửa" từ THIẾT BỊ MỚI trên các ví mình bảo hộ — nguồn màn initiate. */
export type GuardianDeviceRequestItem = {
  deviceRequest: {
    id: string;
    walletId: string;
    verifier: string;
    keyBase64: string;
    fingerprint: string;
    status: string;
    createdAt: string;
  };
  wallet: { id: string; stellarAddress: string };
};

export const guardianDeviceRequestsOptions = queryOptions({
  queryKey: guardianInboxKeys.deviceRequests,
  queryFn: async () => {
    const res = await apiClient.get<{ data: GuardianDeviceRequestItem[] }>(
      "/api/recovery/guardian/device-requests",
    );
    return res.data;
  },
  // Lô R1: query này giờ nuôi badge tab + khối "đang chờ" ở /protecting, không
  // còn chỉ phục vụ màn initiate → cần cùng lưới đỡ như hai nguồn kia, nếu
  // không SSE hỏng là số badge đứng im.
  refetchOnWindowFocus: true,
});
