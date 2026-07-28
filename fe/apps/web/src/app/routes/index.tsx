// `/` KHÔNG có nội dung riêng — nó là ngã ba theo PHIÊN:
//   CÓ phiên   → postAuthPath(role)  (admin → /admin, user thường → /wallet)
//   CHƯA phiên → /welcome            (màn mở đầu cho khách)
// Trước 2026-07-28 redirect VÔ ĐIỀU KIỆN sang /welcome ⇒ user thường đăng nhập
// xong (postAuthPath cũ fallback "/") rơi ngược về màn khách — không bao giờ
// vào được app. `/welcome` chỉ dành cho người CHƯA đăng nhập.
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
// khi component render nên không nháy một frame nội dung cũ. Session đọc qua
// sessionQueryOptions (cache 30s, lỗi mạng resolve null → về /welcome, không
// trắng màn) — cùng nguồn với guard `_authenticated`.
import { postAuthPath, sessionQueryOptions } from "@repo/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions(authClient));
    throw redirect({ to: session?.user ? postAuthPath(session.user.role) : "/welcome" });
  },
});
