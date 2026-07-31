// Lô R7 (D1) — ẢNH ĐẠI DIỆN bằng CHỮ CÁI ĐẦU, thay cho ảnh người thật.
//
// Hai lý do bỏ ảnh stock ở `/guardian` và `/guardian/approve`:
//  1. Người dùng đọc ảnh là ảnh NGƯỜI THÂN MÌNH. Đây là màn quyết định có trao
//     ví cho một khoá mới hay không — một khuôn mặt lạ đặt cạnh câu hỏi đó là
//     thông tin sai ở đúng chỗ không được phép sai.
//  2. Ảnh người thật không xin phép, trong một app tài chính, là chuyện không nên.
//
// Chữ cái đầu thì luôn đúng: nó lấy từ chính cái tên đang hiển thị ngay bên cạnh.
import { cn } from "./utils";

/**
 * Chữ cái đầu của tên hiển thị, IN HOA theo locale.
 *
 * Dùng `Intl.Segmenter` theo grapheme thay vì `[0]`: tiếng Việt có dấu tổ hợp
 * ("Ngọc" ở dạng NFD là `N` + `g` + `o` + `◌̣`…), và emoji/chữ ngoài BMP thì
 * `[0]` cắt đúng nửa ký tự rồi render ra ô vuông. Không có tên → dấu hỏi, không
 * bịa chữ từ địa chỉ ví (base32 không phải tên ai).
 */
export function initialOf(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const first = segmenter.segment(trimmed)[Symbol.iterator]().next();
  const grapheme = first.done ? "" : first.value.segment;
  return grapheme ? grapheme.toLocaleUpperCase() : "?";
}

export function InitialsAvatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      data-testid="initials-avatar"
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground text-lg",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
