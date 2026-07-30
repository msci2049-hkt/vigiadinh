// Badge "việc của người bảo hộ" trên tab Người thân (B2 lô 30/07): đếm phiếu
// chi chờ chính user này duyệt + yêu cầu khôi phục đang mở trên các ví đang
// gác. Không phụ thuộc email (B3 — email vào spam là mất tích): SSE
// (use-realtime-updates) invalidate cả hai query nguồn nên số sống realtime,
// refetchOnWindowFocus là lưới đỡ khi SSE hỏng.
//
// Lô R1 — nguồn thứ BA: "tiếng gõ cửa" của thiết bị mới (device-request). Trước
// đó badge chỉ đếm khôi phục ĐÃ MỞ on-chain, mà muốn mở thì phải có một guardian
// bấm trước — nên đúng cái việc mở màn cho cả luồng lại là việc duy nhất không
// được đếm. Ngày 30/07 knock lúc 17:10 không hiện ở đâu trong app, một phần vì
// chỗ này. Ví đã có khôi phục mở thì knock KHÔNG đếm nữa (cùng luật lọc với màn
// /guardian và /protecting) — nếu không, một ví đang xử lý dở đếm thành hai việc.
//
// `enabled` do tầng app đưa xuống (chỉ true trên hub path đã qua cổng đăng
// nhập) — đường public không được bắn ba query này để khỏi 401 oan.
import { useQuery } from "@tanstack/react-query";
import { guardianDeviceRequestsOptions, guardianInboxOptions } from "../api/guardian-inbox";
import { pendingApprovalsOptions } from "../api/pending-approvals";

export function useGuardianWorkBadge(enabled: boolean): number {
  const inbox = useQuery({ ...guardianInboxOptions, enabled });
  const approvals = useQuery({ ...pendingApprovalsOptions, enabled });
  const knocks = useQuery({ ...guardianDeviceRequestsOptions, enabled });
  if (!enabled) return 0;
  const openWalletIds = new Set((inbox.data ?? []).map((i) => i.wallet.id));
  const pendingKnocks = (knocks.data ?? []).filter((k) => !openWalletIds.has(k.wallet.id));
  return (inbox.data?.length ?? 0) + (approvals.data?.length ?? 0) + pendingKnocks.length;
}
