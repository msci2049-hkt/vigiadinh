// Chiều NGƯỢC (C7) — GET /api/guardians/protecting: các ví user này đang gác.
// BE chỉ trả cột an toàn (chốt bằng key-list test protectingItemView) — không
// có email / địa chỉ ví / số dư của chủ ví ở chiều này.
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { GuardianStatus } from "./guardians";

export type ProtectingItem = {
  id: string;
  wallet_id: string;
  status: GuardianStatus;
  owner_name: string | null;
  /** Email chủ ví ĐÃ che sẵn từ BE ("ab***@gmail.com") — bản đầy đủ không bao giờ tới FE. */
  owner_email_masked: string;
  protecting_since: string;
  last_seen_at: string | null;
};

export const protectingKeys = { all: ["family", "protecting"] as const };

export const protectingOptions = queryOptions({
  queryKey: protectingKeys.all,
  queryFn: async () => {
    const res = await apiClient.get<{ data: ProtectingItem[] }>("/api/guardians/protecting");
    return res.data;
  },
  // LÔ 3: lưới đỡ khi SSE hỏng — quay lại tab là tự cập nhật.
  refetchOnWindowFocus: true,
});

/** Một chạm "tôi còn đây" — POST /api/presence/ack ghi last_seen_at cho MỌI
 * dòng guardian của user (nguồn "hoạt động 2 giờ trước" phía chủ ví).
 * Fire-and-forget: lỗi mạng không được chặn màn đọc. */
export async function ackPresence(): Promise<void> {
  await apiClient.post("/api/presence/ack", {});
}
