# FamilyWallet — Extension MV3 (PHA 9.1)

Vỏ THỨ BA của cùng một lõi (web + APK + extension). Giá trị vỏ app (đường A, skill
`vi-extension-mv3` §0): guardian ngồi máy tính cả ngày — yêu cầu duyệt hiện thành **số đỏ**
trên toolbar thì xử lý trong 30 giây, thay vì 4 tiếng mới mở app điện thoại.

> **Trạng thái:** extension "load unpacked" chạy được ngay (badge poll + popup + 3 tiếng).
> Provider cho dApp (đường B — `KitActions` của stellar-wallets-kit) là việc SAU, chưa làm.

## Chạy thử (demo — không cần store)

1. `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `extension/`.
2. Sửa `API_BASE` trong `service-worker.js` + `popup.js` và `host_permissions` trong
   `manifest.json` thành domain thật của bản deploy (mặc định `app.familywallet.example`).
3. Đăng nhập web app trong một tab (cookie session cùng domain) → SW poll
   `/api/recovery/guardian` + `/guardian/device-requests` mang cookie → badge đỏ hiện số
   yêu cầu; popup mở web `/guardian`.

## 5 quyết định manifest (skill §1)

- **M1 · `key` cố định:** bản unpacked dev có ID ổn định theo ĐƯỜNG DẪN thư mục (không đổi khi
  reload) — đủ cho demo. Lên store / muốn ID cố định tuyệt đối: thêm `"key": "<base64 DER pubkey>"`
  (sinh: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A`).
  ⚠️ ID nằm trong `chrome-extension://<id>` = **origin được ký trong WebAuthn** → origin-verifier
  production PHẢI allow-list origin này (skill `stellar-security` K1). Đổi key = đổi ID = passkey gãy.
- **M2 · `host_permissions` chỉ domain của mình** — vừa là điều kiện rpId override, vừa là điểm
  Chrome Web Store soi. Không xin `<all_urls>`.
- **M3 · WebAuthn trong extension** cần Chrome 122+ (khai `rpId` = domain trong host_permissions);
  passkey tạo trên web dùng lại được, nhưng `origin` ký vẫn là `chrome-extension://<id>`.
- **M4 · MV3 cấm remote code** — mọi JS trong gói, không `eval`, không CDN. CSP mặc định đã chặn.
- **M5 · `_locales/{en,vi,zh_CN}`** — CWS listing đọc tên/mô tả từ đây (đủ 3 tiếng).

## Service worker phù du (skill §2)

SW ngủ ~30s khi rảnh. Nên: state ở `chrome.storage.session`, việc định kỳ ở `chrome.alarms`
(1 phút/lần), badge set từ SW (`chrome.action.setBadgeText`). Popup đóng là unmount — popup chỉ
đọc storage + nhờ SW `poll-now`, không tự giữ trạng thái.

## Ký giao dịch trong extension = quyền HẸP

Signer của extension trong smart account nên là context rule quyền hẹp + `valid_until` (duyệt
guardian + gửi dưới hạn mức, KHÔNG đổi policy) — máy tính bẩn hơn điện thoại, extension bị chiếm
cũng chỉ làm được trong hộp đó (skill `stellar-passkey-smart-account`). Việc dựng rule hẹp cụ thể
làm khi nối đường ký thật vào extension (chưa trong bản này).

## Cổng nghiệm thu cứng (skill) — trạng thái

- [x] Static shell chạy load-unpacked, badge poll từ SW, popup 3 tiếng.
- [ ] Tắt/mở Chrome → ID không đổi (bản unpacked: ổn định theo path; verify khi có domain thật).
- [ ] Passkey tạo trên web ký được trong extension, verifier testnet nhận (cần Chrome 122+ + domain).
- [ ] Badge nhảy số khi có yêu cầu guardian lúc popup đóng (verify với BE sống + đăng nhập).

## icons/

Chưa kèm PNG (tránh nhị phân rác trong repo). Sinh bằng `@capacitor/assets` hoặc bất kỳ bộ
16/48/128 nào trước khi nộp store; bản load-unpacked chạy không cần icon.
