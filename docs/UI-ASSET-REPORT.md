# UI Asset Runtime Report — VíGiaĐình

Ngày chạy: 2026-07-29

Lệnh chuẩn: `corepack pnpm test:assets`

Phạm vi: đúng 54 route sản phẩm, Chromium production build, API được mock cục bộ.

## Kết quả

- Route đã mở: 54/54
- Route sạch: 54/54
- Tổng lượt `<img>` đã decode: 7
- Tổng lượt SVG đã kiểm tra cấu trúc: 175
- Tổng lỗi: 0

Listener response/console/pageerror/requestfailed được gắn trước lần `goto` đầu tiên. Bộ dò chờ `document.fonts.ready`, không dùng `networkidle`.

| # | Route | Ảnh | SVG | Kết quả |
|---:|---|---:|---:|---|
| 1 | `/welcome` | 1 | 1 | PASS |
| 2 | `/get-started` | 0 | 3 | PASS |
| 3 | `/passkey` | 0 | 7 | PASS |
| 4 | `/login` | 0 | 0 | PASS |
| 5 | `/sign-up` | 0 | 0 | PASS |
| 6 | `/verify-email?email=owner%40example.com` | 0 | 0 | PASS |
| 7 | `/forgot-password` | 0 | 0 | PASS |
| 8 | `/reset-password?email=owner%40example.com` | 0 | 0 | PASS |
| 9 | `/unauthorized` | 0 | 0 | PASS |
| 10 | `/recovery` | 0 | 3 | PASS |
| 11 | `/recovery/find-wallet` | 0 | 1 | PASS |
| 12 | `/recovery/sent?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 6 | PASS |
| 13 | `/recovery/progress?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 0 | PASS |
| 14 | `/recovery/countdown?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 1 | PASS |
| 15 | `/recovery/done?address=CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7` | 0 | 2 | PASS |
| 16 | `/setup` | 1 | 4 | PASS |
| 17 | `/setup/assistant` | 0 | 2 | PASS |
| 18 | `/setup/choose-guardians` | 0 | 2 | PASS |
| 19 | `/setup/invite` | 0 | 2 | PASS |
| 20 | `/setup/threshold` | 0 | 3 | PASS |
| 21 | `/setup/timelock` | 0 | 1 | PASS |
| 22 | `/setup/review` | 0 | 2 | PASS |
| 23 | `/setup/done` | 1 | 5 | PASS |
| 24 | `/wallet` | 0 | 11 | PASS |
| 25 | `/wallet/send` | 0 | 3 | PASS |
| 26 | `/wallet/receive` | 0 | 4 | PASS |
| 27 | `/wallet/history` | 0 | 6 | PASS |
| 28 | `/guardians` | 0 | 5 | PASS |
| 29 | `/guardians/g1` | 0 | 1 | PASS |
| 30 | `/night-watch` | 0 | 6 | PASS |
| 31 | `/night-watch/log` | 0 | 6 | PASS |
| 32 | `/night-watch/alert` | 0 | 3 | PASS |
| 33 | `/night-watch/resolve` | 0 | 3 | PASS |
| 34 | `/night-watch/waiting` | 1 | 2 | PASS |
| 35 | `/night-watch/guardian-view` | 1 | 1 | PASS |
| 36 | `/guardian` | 0 | 2 | PASS |
| 37 | `/guardian/approve?wallet=w1` | 0 | 5 | PASS |
| 38 | `/guardian/approve-intent?intent=intent-approval-1` | 0 | 2 | PASS |
| 39 | `/guardian/approve-warning?wallet=w1` | 0 | 4 | PASS |
| 40 | `/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 2 | PASS |
| 41 | `/guardian/accept?token=asset-audit-token` | 1 | 7 | PASS |
| 42 | `/guardian/initiate?wallet=w1` | 0 | 4 | PASS |
| 43 | `/block` | 0 | 3 | PASS |
| 44 | `/block/confirm` | 0 | 4 | PASS |
| 45 | `/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 2 | PASS |
| 46 | `/inheritance` | 1 | 7 | PASS |
| 47 | `/inheritance/heartbeat` | 0 | 3 | PASS |
| 48 | `/inheritance/claim` | 0 | 2 | PASS |
| 49 | `/settings` | 0 | 8 | PASS |
| 50 | `/protecting` | 0 | 5 | PASS |
| 51 | `/admin` | 0 | 3 | PASS |
| 52 | `/admin/users` | 0 | 8 | PASS |
| 53 | `/admin/sessions` | 0 | 3 | PASS |
| 54 | `/admin/settings` | 0 | 5 | PASS |

## Chi tiết lỗi

Không phát hiện response >=400, lỗi console cùng origin, ảnh vỡ/1×1, SVG rỗng hoặc font chưa tải.
