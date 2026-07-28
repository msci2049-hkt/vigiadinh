// Thiệp ảnh QR lời mời (bug B phiên 28/07) — người Việt gửi nhau qua Zalo/
// Messenger bằng ẢNH, không phải link. Vẽ HOÀN TOÀN phía client (canvas +
// module của `qrcode` — cùng package màn Nhận đang dùng): token lời mời không
// bao giờ rời client, CẤM dịch vụ QR online.
//
// Ảnh là "tấm thiệp" chứ không phải QR trần: tiêu đề + tên gợi nhớ + câu nhắc
// để người nhận hiểu được khi thấy nó trong nhóm chat. CỐ Ý KHÔNG in link/token
// dạng chữ lên ảnh — ảnh dễ bị chuyển tiếp nhầm nhóm; QR đã chứa link rồi.
import { create as createQrCode } from "qrcode";

/** Tên file an toàn: bỏ dấu tiếng Việt, đ→d, khoảng trắng → gạch nối. */
export function slugifyLabel(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "nguoi-than";
}

/** Font hệ thống — dấu tiếng Việt/chữ Hán không vỡ, không tải font ngoài. */
const FONT_STACK = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export async function renderInviteCardPng(input: {
  url: string;
  label: string;
  title: string;
  subtitle: string;
}): Promise<Blob> {
  // 1080×1350 dọc — khung quen thuộc của ảnh chia sẻ Zalo/Messenger, đủ nét.
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Tiêu đề
  ctx.fillStyle = "#1f1a10";
  ctx.font = `bold 56px ${FONT_STACK}`;
  ctx.fillText(input.title, W / 2, 150, W - 120);

  // QR — vẽ THẲNG từ ma trận module (không đi vòng qua SVG/Image, không lệ
  // thuộc rasterizer). Quiet zone 4 module mỗi cạnh — thiếu là máy quét mù.
  const qr = createQrCode(input.url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 4;
  const cell = Math.floor(760 / (size + quiet * 2));
  const total = cell * (size + quiet * 2);
  const x0 = Math.round((W - total) / 2);
  const y0 = 280;
  ctx.fillStyle = "#000000";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.get(row, col)) {
        ctx.fillRect(x0 + (col + quiet) * cell, y0 + (row + quiet) * cell, cell, cell);
      }
    }
  }

  // Tên gợi nhớ + câu nhắc
  ctx.fillStyle = "#1f1a10";
  ctx.font = `bold 52px ${FONT_STACK}`;
  ctx.fillText(input.label, W / 2, y0 + total + 100, W - 120);
  ctx.fillStyle = "#6b6357";
  ctx.font = `38px ${FONT_STACK}`;
  ctx.fillText(input.subtitle, W / 2, y0 + total + 180, W - 120);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG_RENDER_FAILED"))),
      "image/png",
    );
  });
}
