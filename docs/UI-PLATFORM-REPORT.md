# UI Platform Report — VíGiaĐình

Ngày kiểm: 2026-07-25

## Kết quả tự động

- Ma trận Chromium production, locale VI: 41 route × 5 viewport = 205 ca.
- Baseline: 0/205 PASS. Cả 205 ca đều bị chặn bởi tap target ngôn ngữ 44 px;
  ngoài ra link phụ 44–46 px, hai proof-link 16 px và radio threshold bị ép hẹp.
- Sau vá: 205/205 PASS, 0 scroll ngang, 0 container cắt dọc, 0 text bị clip,
  0 tap target dưới 48 px, 0 ảnh có nguy cơ méo và 0 nút submit không thể đưa
  vào viewport 400×320 mô phỏng bàn phím.
- Android Back tại `/wallet/send` review: PASS. Back đưa về form nhập, giữ nguyên
  số tiền và người nhận, không gọi submit; khi signing/submitting thì giữ màn review.
- Meta viewport có `viewport-fit=cover` và `interactive-widget=resizes-content`.
- Shell dùng `-webkit-fill-available` fallback, `svh` và `dvh`; có nhánh
  `@media (display-mode: standalone)`, safe-area top/bottom và keyboard focus.

## Hành vi Back — 41/41 route

| # | Route | Back cứng / browser Back |
|---:|---|---|
| 1 | `/welcome` | Về lịch sử trước; không có mutation. |
| 2 | `/get-started` | Về `/welcome`; không có mutation. |
| 3 | `/passkey` | Về bước trước; passkey chỉ chạy khi bấm CTA, Back không kích hoạt. |
| 4 | `/recovery` | Về lịch sử trước; recovery draft chỉ ở RAM của phiên SPA, không tự gửi/persist. |
| 5 | `/recovery/find-wallet` | Về `/recovery`; nhập chưa submit không tạo yêu cầu. |
| 6 | `/recovery/sent` | Về find-wallet; địa chỉ recovery nằm trong query string. |
| 7 | `/recovery/progress` | Về route lịch sử; địa chỉ recovery nằm trong query string. |
| 8 | `/recovery/countdown` | Về progress; địa chỉ recovery nằm trong query string. |
| 9 | `/recovery/done` | Về countdown/progress; không tự finalize khi Back. |
| 10 | `/setup` | Về lịch sử trước; tạo ví chỉ chạy khi bấm CTA. |
| 11 | `/setup/assistant` | Về `/setup`; không có mutation. |
| 12 | `/setup/choose-guardians` | Về bước setup trước; label chưa gửi không được lưu. |
| 13 | `/setup/invite` | Về bước trước; lời mời đã tạo vẫn ở server, draft label chưa gửi bị bỏ. |
| 14 | `/setup/threshold` | Về choose-guardians; lựa chọn chưa lưu bị bỏ, không tự mutation. |
| 15 | `/setup/timelock` | Về threshold; lựa chọn chưa lưu bị bỏ, không tự mutation. |
| 16 | `/setup/review` | Về timelock; đăng ký chỉ chạy khi bấm CTA. |
| 17 | `/setup/done` | Về review/history; không có mutation. |
| 18 | `/wallet` | Về lịch sử trước; màn chỉ đọc. |
| 19 | `/wallet/send` | Enter: về lịch sử. Review: pop entry nội bộ về form và giữ input; busy: ở lại review; không submit. |
| 20 | `/wallet/receive` | Về wallet; copy/QR không tạo giao dịch. |
| 21 | `/wallet/history` | Về wallet; màn chỉ đọc. |
| 22 | `/guardians` | Về wallet/history; màn chỉ đọc. |
| 23 | `/guardians/$guardianId` | Về danh sách guardian; màn chỉ đọc. |
| 24 | `/night-watch` | Về wallet/history; không tự block. |
| 25 | `/night-watch/log` | Về night-watch; màn chỉ đọc. |
| 26 | `/night-watch/alert` | Về night-watch; không tự resolve. |
| 27 | `/night-watch/resolve` | Về alert; không có mutation tự chạy. |
| 28 | `/night-watch/waiting` | Về route trước; màn chỉ đọc. |
| 29 | `/night-watch/guardian-view` | Về route trước; màn chỉ đọc. |
| 30 | `/guardian` | Về lịch sử trước; danh sách chỉ đọc. |
| 31 | `/guardian/approve` | Về warning/inbox; approve chỉ chạy khi bấm CTA. |
| 32 | `/guardian/approve-warning` | Về inbox; không tự approve. |
| 33 | `/guardian/approved` | Về approve/history; không lặp transaction. |
| 34 | `/guardian/accept` | Về lịch sử trước; accept chỉ chạy khi bấm CTA. |
| 35 | `/guardian/initiate` | Về inbox; initiate chỉ chạy khi bấm CTA. |
| 36 | `/block` | Về night-watch; không tự veto. |
| 37 | `/block/confirm` | Về block; veto chỉ chạy khi bấm danger CTA. |
| 38 | `/block/done` | Về confirm/history; không lặp transaction. |
| 39 | `/inheritance` | Về wallet/history; màn tổng quan không tự mutation. |
| 40 | `/inheritance/heartbeat` | Về inheritance; heartbeat chỉ chạy khi bấm CTA. |
| 41 | `/inheritance/claim` | Về inheritance; claim/reset chỉ chạy khi bấm CTA. |

## Gate cần máy thật

- iOS Safari/PWA standalone thật: chưa thể chạy trên máy Windows này. Nhánh CSS và
  viewport được kiểm tự động nhưng không được ghi là PASS máy thật.
- Android APK/Capacitor thật: chưa có JDK/Android SDK và native wrapper đã sync, nên
  chưa thể ghi PASS APK; Back logic của luồng gửi đã PASS trong browser history.
- Chrome MV3 load-unpacked thật: đã kết nối Chrome nhưng bề mặt điều khiển chặn
  `chrome://extensions` theo chính sách an toàn. Không lách bằng CDP/Playwright khác;
  vì vậy chưa load được thư mục `extension/` và chưa được ghi PASS. Viewport web
  400×560 đã PASS 41/41 nhưng không thay thế popup extension thật.

## Sáu mục QA tay — trạng thái cuối

| # | Mục | Trạng thái | Bằng chứng / giới hạn |
|---:|---|---|---|
| 1 | iOS standalone | **CHƯA CHẠY** | Host Windows không có iPhone/iOS Safari. Safe-area + standalone CSS có test tự động, không overclaim máy thật. |
| 2 | iOS bàn phím | **CHƯA CHẠY** | Viewport 400×320 mô phỏng bàn phím giữ submit trong vùng thấy được; chưa có iOS thật. |
| 3 | Extension popup load-unpacked | **CHƯA CHẠY** | Chrome đã kết nối nhưng `chrome://extensions` bị chính sách browser-control chặn. |
| 4 | Android Back phần cứng | **CHƯA CHẠY MÁY THẬT** | Browser-history test PASS: không submit, không mất input; không có Android SDK/device để gọi Back phần cứng. |
| 5 | 320 px + chuỗi VI dài | **PASS TỰ ĐỘNG** | 41/41 ở 320×568, locale VI; 0 overflow/clip/tap target lỗi. |
| 6 | Ảnh nhân vật 41 màn | **PASS REVIEW** | Đã đọc bốn contact sheet của 82 baseline; không ô trống/icon vỡ/placeholder lạc. |

Kết luận theo điều kiện người giao việc: QA tay chưa đủ, nên **không push**.

Static audit bổ sung cho mục 3: `extension/manifest.json` khai
`icons/icon-{16,48,128}.png` nhưng cả ba file đều không tồn tại. Phạm vi được giao
chỉ cho sửa `fe/`, nên không tự ý vá `extension/`; đây là blocker cần xử trước lần
load-unpacked tiếp theo.
