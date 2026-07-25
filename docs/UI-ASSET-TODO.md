# UI Asset TODO — VíGiaĐình

Ngày chốt: 2026-07-25

Phạm vi: 41 route sản phẩm trong `docs/UI-AUDIT-STATE.md`.

## Raster còn nợ

**0 ảnh.**

Toàn bộ raster đang render có file AVIF/WebP/fallback, kích thước nội tại và đã
decode thành công trong production asset audit. 82 baseline visual đã được review
không thấy ô trống, ảnh vỡ hoặc placeholder lạc.

Không tính ba icon PNG đang thiếu của `extension/manifest.json`: thư mục
`extension/` nằm ngoài phạm vi chỉ-`fe/` của đợt audit và được khai riêng thành
blocker trong `docs/UI-PLATFORM-REPORT.md`.
