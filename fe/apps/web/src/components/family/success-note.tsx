// Khối TIN TỐT (tích xanh) — dùng khi chuyện cần nói là "xong rồi", không phải
// "bạn làm sai": phiếu đã ghi, lệnh khôi phục đã đóng… (R5 tách từ approve.tsx).
import { Icon } from "./icons";

export function SuccessNote({ title, body }: { title: string; body?: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-card border border-success bg-success/10 p-4"
      role="status"
    >
      <Icon name="checkCircle" size={24} className="mt-0.5 shrink-0 text-success" />
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        {body ? <p className="text-muted-foreground text-sm">{body}</p> : null}
      </div>
    </div>
  );
}
