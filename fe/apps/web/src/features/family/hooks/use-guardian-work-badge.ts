// Badge "việc của người bảo hộ" trên tab Người thân (B2 lô 30/07): đếm phiếu
// chi chờ chính user này duyệt + yêu cầu khôi phục đang mở trên các ví đang
// gác. Không phụ thuộc email (B3 — email vào spam là mất tích): SSE
// (use-realtime-updates) invalidate cả hai query nguồn nên số sống realtime,
// refetchOnWindowFocus là lưới đỡ khi SSE hỏng.
//
// `enabled` do tầng app đưa xuống (chỉ true trên hub path đã qua cổng đăng
// nhập) — đường public không được bắn hai query này để khỏi 401 oan.
import { useQuery } from "@tanstack/react-query";
import { guardianInboxOptions } from "../api/guardian-inbox";
import { pendingApprovalsOptions } from "../api/pending-approvals";

export function useGuardianWorkBadge(enabled: boolean): number {
  const inbox = useQuery({ ...guardianInboxOptions, enabled });
  const approvals = useQuery({ ...pendingApprovalsOptions, enabled });
  if (!enabled) return 0;
  return (inbox.data?.length ?? 0) + (approvals.data?.length ?? 0);
}
