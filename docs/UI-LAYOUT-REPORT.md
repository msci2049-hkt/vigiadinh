# UI Layout Matrix Report — VíGiaĐình

Ngày chạy: 2026-07-29

Lệnh chuẩn: `corepack pnpm test:layout`

Phạm vi: 54 route × 7 viewport = 378 ca trên Chromium production build, locale VI.

## Tổng hợp

- PASS: 378/378
- FAIL: 0/378
- Mỗi ca kiểm: scroll ngang, container cắt dọc, text bị clip, tap target dưới 48 px,
  ảnh có nguy cơ méo tỉ lệ và khả năng đưa nút submit vào vùng thấy được khi viewport bàn phím co.

| Viewport | Ca | PASS | FAIL |
|---|---:|---:|---:|
| small-android (320×568) | 54 | 54 | 0 |
| iphone-375 (375×812) | 54 | 54 | 0 |
| iphone (390×844) | 54 | 54 | 0 |
| iphone-pro-max (430×932) | 54 | 54 | 0 |
| extension-popup (400×560) | 54 | 54 | 0 |
| tablet (1024×900) | 54 | 54 | 0 |
| desktop-wide (1440×900) | 54 | 54 | 0 |

## Chi tiết lỗi

| Route | Viewport | Lỗi |
|---|---|---|
Không còn ca lỗi.
