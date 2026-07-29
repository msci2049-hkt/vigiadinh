// Sentry PHẢI import đầu tiên — init trước mọi module để bắt cả lỗi lúc boot.
import "@/instrument";

// SỰ CỐ 29/07 12:05 (edge, KHÔNG phải lỗi code) — đọc trước khi xoá dòng nào ở đây:
// lô trước chỉ đụng chunk lazy nên chunk VÀO giữ nguyên nội dung ⇒ giữ nguyên tên
// `index-<hash>.js`. Trong khe giữa lúc index.html mới lên và lúc asset nhân bản
// xong, một request vào đúng đường dẫn đó rơi xuống catch-all `/* /index.html 200`,
// và Cloudflare cache bản HTML ấy với `max-age=31536000, immutable`. Từ đó trình
// duyệt tải chunk vào ra HTML → nosniff chặn → TRẮNG TRANG, trong khi mọi kiểm tra
// hạ tầng vẫn xanh (index.html đúng, các chunk khác đúng, `?v=` cũng đúng).
// Cách chữa đã dùng: đổi nội dung chunk vào ⇒ đổi hash ⇒ index.html trỏ sang đường
// dẫn CHƯA từng bị cache. Cách chữa gốc là purge cache đường dẫn đó trên Cloudflare.
// Dấu hiệu nhận ra lần sau (10 giây):
//   curl -sI https://<site>/assets/index-<hash>.js | grep -i content-type
//   → `text/html` là dính; so với cùng URL kèm `?v=1` sẽ ra `application/javascript`.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/app/provider";
import { restoreWalletSession } from "@/features/wallet/lib/wallet-token";
import "@/index.css";

// Phiên ví SEP-45 (Bearer) — nối lại header trước khi UI render, để query đầu
// tiên của màn ví không bị 401 oan khi JWT còn hạn.
restoreWalletSession();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppProvider />
  </StrictMode>,
);
