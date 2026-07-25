# UI Layout Matrix Report — VíGiaĐình

Ngày chạy: 2026-07-25

Lệnh chuẩn: `corepack pnpm test:layout`

Phạm vi: 41 route × 5 viewport = 205 ca trên Chromium production build, locale VI.

## Tổng hợp

- PASS: 205/205
- FAIL: 0/205
- Mỗi ca kiểm: scroll ngang, container cắt dọc, text bị clip, tap target dưới 48 px,
  ảnh có nguy cơ méo tỉ lệ và khả năng đưa nút submit vào vùng thấy được khi viewport bàn phím co.

| Viewport | Ca | PASS | FAIL |
|---|---:|---:|---:|
| small-android (320×568) | 41 | 41 | 0 |
| iphone (390×844) | 41 | 41 | 0 |
| iphone-pro-max (430×932) | 41 | 41 | 0 |
| extension-popup (400×560) | 41 | 41 | 0 |
| tablet (1024×900) | 41 | 41 | 0 |

## Chi tiết lỗi

| Route | Viewport | Lỗi |
|---|---|---|
Không còn ca lỗi.
