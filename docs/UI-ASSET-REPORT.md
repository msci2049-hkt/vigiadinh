# UI Asset Runtime Report — VíGiaĐình

Ngày chạy: 2026-07-25

Lệnh chuẩn: `corepack pnpm test:assets`

Phạm vi: đúng 41 route sản phẩm, Chromium production build, API được mock cục bộ.

## Kết quả

- Route đã mở: 41/41
- Route sạch: 18/41
- Tổng lượt `<img>` đã decode: 12
- Tổng lượt SVG đã kiểm tra cấu trúc: 34
- Tổng lỗi: 53

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
| 19 | `/wallet/send` | 0 | 0 | FAIL (3) |
| 20 | `/wallet/receive` | 0 | 0 | FAIL (8) |
| 21 | `/wallet/history` | 0 | 0 | FAIL (2) |
| 22 | `/guardians` | 0 | 0 | FAIL (2) |
| 23 | `/guardians/g1` | 0 | 0 | FAIL (2) |
| 24 | `/night-watch` | 0 | 0 | FAIL (2) |
| 25 | `/night-watch/log` | 0 | 0 | FAIL (2) |
| 26 | `/night-watch/alert` | 0 | 0 | FAIL (2) |
| 27 | `/night-watch/resolve` | 0 | 0 | FAIL (2) |
| 28 | `/night-watch/waiting` | 0 | 0 | FAIL (2) |
| 29 | `/night-watch/guardian-view` | 0 | 0 | FAIL (2) |
| 30 | `/guardian` | 0 | 0 | FAIL (2) |
| 31 | `/guardian/approve?wallet=w1` | 0 | 0 | FAIL (2) |
| 32 | `/guardian/approve-warning?wallet=w1` | 0 | 0 | FAIL (2) |
| 33 | `/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 0 | FAIL (2) |
| 34 | `/guardian/accept?token=asset-audit-token` | 0 | 0 | FAIL (2) |
| 35 | `/guardian/initiate?wallet=w1` | 0 | 0 | FAIL (2) |
| 36 | `/block` | 0 | 0 | FAIL (2) |
| 37 | `/block/confirm` | 0 | 0 | FAIL (2) |
| 38 | `/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` | 0 | 0 | FAIL (2) |
| 39 | `/inheritance` | 0 | 0 | FAIL (2) |
| 40 | `/inheritance/heartbeat` | 0 | 0 | FAIL (2) |
| 41 | `/inheritance/claim` | 0 | 0 | FAIL (2) |

## Chi tiết lỗi

- `/wallet/send` — navigation: page.evaluate: NetworkError: A network error occurred.
- `/wallet/send` — network request-failed: GET /assets/inter-latin-wght-normal-Dx4kXJAl.woff2 (font)
- `/wallet/send` — console: Failed to load resource: net::ERR_CONNECTION_REFUSED
- `/wallet/receive` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/wallet/receive
Call log:
[2m  - navigating to "http://localhost:4174/wallet/receive", waiting until "domcontentloaded"[22m

- `/wallet/receive` — network request-failed: GET /assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2 (font)
- `/wallet/receive` — network request-failed: GET /assets/fw-CxX5HP36.js (script)
- `/wallet/receive` — network request-failed: GET /assets/fw-ugljr9vw.js (script)
- `/wallet/receive` — network request-failed: GET /wallet/receive (document)
- `/wallet/receive` — console: Failed to load resource: net::ERR_CONNECTION_REFUSED
- `/wallet/receive` — console: Failed to load resource: net::ERR_CONNECTION_REFUSED
- `/wallet/receive` — console: Failed to load resource: net::ERR_CONNECTION_REFUSED
- `/wallet/history` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/wallet/history
Call log:
[2m  - navigating to "http://localhost:4174/wallet/history", waiting until "domcontentloaded"[22m

- `/wallet/history` — network request-failed: GET /wallet/history (document)
- `/guardians` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardians
Call log:
[2m  - navigating to "http://localhost:4174/guardians", waiting until "domcontentloaded"[22m

- `/guardians` — network request-failed: GET /guardians (document)
- `/guardians/g1` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardians/g1
Call log:
[2m  - navigating to "http://localhost:4174/guardians/g1", waiting until "domcontentloaded"[22m

- `/guardians/g1` — network request-failed: GET /guardians/g1 (document)
- `/night-watch` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch
Call log:
[2m  - navigating to "http://localhost:4174/night-watch", waiting until "domcontentloaded"[22m

- `/night-watch` — network request-failed: GET /night-watch (document)
- `/night-watch/log` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch/log
Call log:
[2m  - navigating to "http://localhost:4174/night-watch/log", waiting until "domcontentloaded"[22m

- `/night-watch/log` — network request-failed: GET /night-watch/log (document)
- `/night-watch/alert` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch/alert
Call log:
[2m  - navigating to "http://localhost:4174/night-watch/alert", waiting until "domcontentloaded"[22m

- `/night-watch/alert` — network request-failed: GET /night-watch/alert (document)
- `/night-watch/resolve` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch/resolve
Call log:
[2m  - navigating to "http://localhost:4174/night-watch/resolve", waiting until "domcontentloaded"[22m

- `/night-watch/resolve` — network request-failed: GET /night-watch/resolve (document)
- `/night-watch/waiting` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch/waiting
Call log:
[2m  - navigating to "http://localhost:4174/night-watch/waiting", waiting until "domcontentloaded"[22m

- `/night-watch/waiting` — network request-failed: GET /night-watch/waiting (document)
- `/night-watch/guardian-view` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/night-watch/guardian-view
Call log:
[2m  - navigating to "http://localhost:4174/night-watch/guardian-view", waiting until "domcontentloaded"[22m

- `/night-watch/guardian-view` — network request-failed: GET /night-watch/guardian-view (document)
- `/guardian` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian
Call log:
[2m  - navigating to "http://localhost:4174/guardian", waiting until "domcontentloaded"[22m

- `/guardian` — network request-failed: GET /guardian (document)
- `/guardian/approve?wallet=w1` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian/approve?wallet=w1
Call log:
[2m  - navigating to "http://localhost:4174/guardian/approve?wallet=w1", waiting until "domcontentloaded"[22m

- `/guardian/approve?wallet=w1` — network request-failed: GET /guardian/approve?wallet=w1 (document)
- `/guardian/approve-warning?wallet=w1` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian/approve-warning?wallet=w1
Call log:
[2m  - navigating to "http://localhost:4174/guardian/approve-warning?wallet=w1", waiting until "domcontentloaded"[22m

- `/guardian/approve-warning?wallet=w1` — network request-failed: GET /guardian/approve-warning?wallet=w1 (document)
- `/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Call log:
[2m  - navigating to "http://localhost:4174/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", waiting until "domcontentloaded"[22m

- `/guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` — network request-failed: GET /guardian/approved?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (document)
- `/guardian/accept?token=asset-audit-token` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian/accept?token=asset-audit-token
Call log:
[2m  - navigating to "http://localhost:4174/guardian/accept?token=asset-audit-token", waiting until "domcontentloaded"[22m

- `/guardian/accept?token=asset-audit-token` — network request-failed: GET /guardian/accept?token=asset-audit-token (document)
- `/guardian/initiate?wallet=w1` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/guardian/initiate?wallet=w1
Call log:
[2m  - navigating to "http://localhost:4174/guardian/initiate?wallet=w1", waiting until "domcontentloaded"[22m

- `/guardian/initiate?wallet=w1` — network request-failed: GET /guardian/initiate?wallet=w1 (document)
- `/block` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/block
Call log:
[2m  - navigating to "http://localhost:4174/block", waiting until "domcontentloaded"[22m

- `/block` — network request-failed: GET /block (document)
- `/block/confirm` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/block/confirm
Call log:
[2m  - navigating to "http://localhost:4174/block/confirm", waiting until "domcontentloaded"[22m

- `/block/confirm` — network request-failed: GET /block/confirm (document)
- `/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Call log:
[2m  - navigating to "http://localhost:4174/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", waiting until "domcontentloaded"[22m

- `/block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` — network request-failed: GET /block/done?tx=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa (document)
- `/inheritance` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/inheritance
Call log:
[2m  - navigating to "http://localhost:4174/inheritance", waiting until "domcontentloaded"[22m

- `/inheritance` — network request-failed: GET /inheritance (document)
- `/inheritance/heartbeat` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/inheritance/heartbeat
Call log:
[2m  - navigating to "http://localhost:4174/inheritance/heartbeat", waiting until "domcontentloaded"[22m

- `/inheritance/heartbeat` — network request-failed: GET /inheritance/heartbeat (document)
- `/inheritance/claim` — navigation: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4174/inheritance/claim
Call log:
[2m  - navigating to "http://localhost:4174/inheritance/claim", waiting until "domcontentloaded"[22m

- `/inheritance/claim` — network request-failed: GET /inheritance/claim (document)
