// `/` KHÔNG có nội dung riêng — nó chuyển thẳng sang `/welcome`.
//
// Trước 2026-07-27 file này là TRANG MẪU của template: tiêu đề + 6 thẻ khoe stack
// ("TanStack Router", "Tailwind v4 + shadcn", "RHF + Zod"…) đọc từ khoá i18n
// `home.*`. Nó đã LÊN PRODUCTION và là thứ người dùng thấy đầu tiên ở gốc domain,
// trong khi `/welcome` mới là màn mở đầu thật của sản phẩm.
//
// Vì sao lọt: chuỗi hiển thị nằm trong `locales/*/common.json`, KHÔNG nằm trong
// TSX — grep theo tên biến hay theo "Mau Demo" đều không khớp. Bản tiếng Việt ghi
// "FE mẫu React 19 + Vite — cắm thẳng BE Bun + Hono". Guard đã mở rộng:
// `scripts/check-user-copy.mjs` giờ bắt cả cụm khoe-stack, và deploy-fe.yml quét dist.
//
// Dùng `redirect()` trong `beforeLoad`, KHÔNG `<Navigate>`: beforeLoad chạy TRƯỚC
// khi component render nên không nháy một frame nội dung cũ.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/welcome" });
  },
});
