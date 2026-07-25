# UI Asset Runtime Report — VíGiaĐình

Ngày chạy: 2026-07-25

Lệnh chuẩn: `corepack pnpm test:assets`

Phạm vi: đúng 41 route sản phẩm, Chromium production build, API được mock cục bộ.

## Kết quả

- Route đã mở: 41/41
- Route sạch: 41/41
- Tổng lượt `<img>` đã decode: 23
- Tổng lượt SVG đã kiểm tra cấu trúc: 68
- Tổng lỗi: 0

Listener response/console/pageerror/requestfailed được gắn trước lần `goto` đầu tiên. Bộ dò chờ `document.fonts.ready`, không dùng `networkidle`.

| # | Route | Ảnh | SVG | Kết quả |
|---:|---|---:|---:|---|
| 1 | `/welcome` | 1 | 1 | PASS |
| 2 | `/get-started` | 0 | 3 | PASS |
| 3 | `/passkey` | 3 | 4 | PASS |
| 4 | `/recovery` | 0 | 3 | PASS |
| 5 | `/recovery/find-wallet` | 0 | 1 | PASS |
| 6 | `/recovery/sent?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 3 | 3 | PASS |
| 7 | `/recovery/progress?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 0 | PASS |
| 8 | `/recovery/countdown?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 2 | PASS |
| 9 | `/recovery/done?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 2 | PASS |
| 10 | `/setup` | 1 | 3 | PASS |
| 11 | `/setup/assistant` | 0 | 1 | PASS |
| 12 | `/setup/choose-guardians` | 0 | 1 | PASS |
| 13 | `/setup/invite` | 0 | 1 | PASS |
| 14 | `/setup/threshold` | 0 | 2 | PASS |
| 15 | `/setup/timelock` | 0 | 0 | PASS |
| 16 | `/setup/review` | 0 | 1 | PASS |
| 17 | `/setup/done` | 4 | 1 | PASS |
| 18 | `/wallet` | 0 | 5 | PASS |
| 19 | `/wallet/send` | 0 | 0 | PASS |
| 20 | `/wallet/receive` | 0 | 2 | PASS |
| 21 | `/wallet/history` | 0 | 1 | PASS |
| 22 | `/guardians` | 2 | 0 | PASS |
| 23 | `/guardians/g1` | 1 | 0 | PASS |
| 24 | `/night-watch` | 0 | 2 | PASS |
| 25 | `/night-watch/log` | 0 | 1 | PASS |
| 26 | `/night-watch/alert` | 1 | 1 | PASS |
| 27 | `/night-watch/resolve` | 0 | 2 | PASS |
| 28 | `/night-watch/waiting` | 1 | 1 | PASS |
| 29 | `/night-watch/guardian-view` | 1 | 0 | PASS |
| 30 | `/guardian` | 1 | 0 | PASS |
| 31 | `/guardian/approve?wallet=w1` | 1 | 3 | PASS |
| 32 | `/guardian/approve-warning?wallet=w1` | 0 | 3 | PASS |
| 33 | `/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 1 | PASS |
| 34 | `/guardian/accept?token=asset-audit-token` | 1 | 4 | PASS |
| 35 | `/guardian/initiate?wallet=w1` | 0 | 3 | PASS |
| 36 | `/block` | 0 | 2 | PASS |
| 37 | `/block/confirm` | 0 | 3 | PASS |
| 38 | `/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 1 | PASS |
| 39 | `/inheritance` | 2 | 1 | PASS |
| 40 | `/inheritance/heartbeat` | 0 | 2 | PASS |
| 41 | `/inheritance/claim` | 0 | 1 | PASS |

## Chi tiết lỗi

Không phát hiện response >=400, lỗi console cùng origin, ảnh vỡ/1×1, SVG rỗng hoặc font chưa tải.
