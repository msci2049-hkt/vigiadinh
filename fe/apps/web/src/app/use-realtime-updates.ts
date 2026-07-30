// Realtime cho vỏ đã đăng nhập (LÔ 3, 2026-07-29) — vá "Anh ba nhận lời xong,
// chủ ví phải F5 mới thấy".
//
// MỘT kết nối SSE cho cả app (mount ở AuthenticatedShell): nghe event "domain"
// từ BE (guardian.accepted/added, intent.*) → invalidate cây ["family"] (mọi
// key family/* chung prefix) + toast tiếng người. Hook nền useServerEvents đã
// lo cookie, backoff + jitter khi rớt mạng, đóng khi unmount, và 401/403 thì
// dừng hẳn (session hết — apiClient đá /login).
//
// SSE là at-most-once: sự kiện rớt trong lúc mất kết nối KHÔNG được gửi lại →
// onReconnect refetch-bù; lưới đỡ thứ hai là refetchOnWindowFocus trên các
// query family (đặt tại từng queryOptions) — SSE chết hẳn thì quay lại tab
// vẫn tự cập nhật, không ai kẹt như hiện trạng cũ.
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useServerEvents } from "@/lib/sse";

/** Khớp DomainEventType phía BE (be/src/lib/domain-events.ts). */
const TOAST_KEYS = {
  "guardian.accepted": "realtime.guardianAccepted",
  "guardian.added": "realtime.guardianAdded",
  "intent.awaiting_approval": "realtime.intentPending",
  "intent.approved": "realtime.intentApproved",
  "intent.rejected": "realtime.intentRejected",
  "intent.cancelled": "realtime.intentCancelled",
  "intent.expired": "realtime.intentExpired",
  // Lô policy 2026-07-29 (B7): đề nghị nâng ngưỡng / áp / huỷ — banner ở Cài
  // đặt nằm dưới queryKey ["family"] nên invalidate chung là tự cập nhật.
  "policy.raise_requested": "realtime.policyRaiseRequested",
  "policy.applied": "realtime.policyApplied",
  "policy.cancelled": "realtime.policyCancelled",
  // Lô R1: thiết bị mới gõ cửa xin khôi phục. KHÔNG có mặt ở đây thì parseDomain
  // trả null và sự kiện bị bỏ luôn — kênh sse coi như không tồn tại, đúng kiểu
  // "im lặng bằng cách thành công" mà lô này đang đi vá.
  "recovery.device_requested": "realtime.recoveryDeviceRequested",
} as const;

type DomainType = keyof typeof TOAST_KEYS;

function parseDomain(data: string): { type: DomainType; label?: string } | null {
  try {
    const raw = JSON.parse(data) as { type?: unknown; label?: unknown };
    if (typeof raw.type !== "string" || !(raw.type in TOAST_KEYS)) return null;
    return {
      type: raw.type as DomainType,
      ...(typeof raw.label === "string" ? { label: raw.label } : {}),
    };
  } catch {
    return null;
  }
}

export function useRealtimeUpdates(): void {
  const queryClient = useQueryClient();
  const { t } = useTranslation("fw");

  useServerEvents({
    onEvent: (event) => {
      if (event.event === "domain") {
        const domain = parseDomain(event.data);
        if (!domain) return;
        // Mọi key family/* chung prefix ["family"] — một nhát phủ invites,
        // guardians, protecting, inbox, pending-approvals.
        void queryClient.invalidateQueries({ queryKey: ["family"] });
        toast(t(TOAST_KEYS[domain.type], { name: domain.label ?? "" }));
        return;
      }
      if (event.event === "notification") {
        // Hộp thư trong app (kênh sse của dispatcher) — dữ liệu màn nào đổi
        // thì refetch màn đó; title/body đã render theo locale ở BE nhưng
        // KHÔNG toast lại: sự kiện domain ở trên đã toast ngay lúc xảy ra.
        void queryClient.invalidateQueries({ queryKey: ["family"] });
      }
    },
    onReconnect: () => {
      // Refetch-bù bắt buộc (at-most-once) — sự kiện rớt lúc mất mạng đã mất.
      void queryClient.invalidateQueries({ queryKey: ["family"] });
    },
  });
}
