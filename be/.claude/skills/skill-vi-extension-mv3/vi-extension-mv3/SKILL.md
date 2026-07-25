---
name: vi-extension-mv3
description: >
  Xây extension Chrome Manifest V3 cho ví crypto (kiểu MetaMask/Freighter) từ vỏ app tới provider cho
  dApp: manifest + key cố định (ID = origin được ký), service worker phù du (state/alarms/badge),
  WebAuthn passkey trong extension (rpId override Chrome 122+), hộp duyệt guardian với badge đỏ,
  provider pattern qua stellar-wallets-kit, và toàn bộ luật Chrome Web Store cho ví crypto. Dùng khi:
  tạo extension mới, port SPA thành extension, làm popup/side panel ví, nối dApp, sửa lỗi service worker
  ngủ/mất state/mất socket, hay chuẩn bị nộp store. Trigger: extension, MV3, manifest, chrome.storage,
  service worker, popup, side panel, content script, injected provider, Chrome Web Store, badge.
---

# Ví Extension MV3 — từ vỏ app tới provider dApp

Nguyên tắc gốc: extension là **vỏ thứ ba của một lõi chung** (`packages/core` + `packages/ui`),
không phải codebase riêng. Khác biệt nằm ở shell + adapter, không nằm ở logic.

## 0 · Hai sản phẩm đội chung một vỏ — làm A trước

- **A · Vỏ app:** popup/side panel = số dư, gửi tiền, **hộp duyệt guardian + badge đỏ**. Giá trị thật: guardian là người ngồi máy tính cả ngày — yêu cầu duyệt hiện thành số đỏ trên toolbar thì 30 giây xử lý xong thay vì 4 tiếng mới mở app điện thoại. Chi phí gần bằng 0 nếu FE đã là SPA.
- **B · Provider cho dApp** (kiểu MetaMask): làm SAU, và **cấm tự đẻ API**. Cài đúng interface `KitActions` của `@creit.tech/stellar-wallets-kit` (`getAddress`, `signTransaction`, `signAuthEntry`, `signMessage`, `getNetwork`) + đăng ký module (`ISupportedWallet`: id, name, type, isAvailable, icon, url) → mọi dApp đã dùng Wallets Kit nhận ra ví mà không sửa một dòng. Tự chế `window.vigiadinh` rồi đi năn nỉ từng dApp = đường chết.

## 1 · Manifest — 5 quyết định chốt ngay commit đầu

| # | Chốt | Vì sao |
|---|---|---|
| M1 | **`key` cố định trong manifest** → extension ID ổn định | ID nằm trong `chrome-extension://<id>` = **origin được ký trong WebAuthn**. Không cố định key → mỗi lần load lại đổi ID → verifier từ chối chữ ký. Đây là bug khó truy nhất của cả dự án nếu bỏ qua |
| M2 | `host_permissions` **chỉ** `https://<domain-cua-may>/*` | Vừa là điều kiện rpId override (M3), vừa là điểm CWS soi. Xin `<all_urls>` = tự chuốc vòng duyệt dài |
| M3 | WebAuthn trong extension: **Chrome 122+ / Firefox 150+** cho phép trang extension khai `rpId` của domain nằm trong `host_permissions` | Nghĩa là passkey tạo trên web **dùng lại được** trong extension — cùng credential, cùng `rpId`. Nhưng `origin` được ký vẫn là `chrome-extension://<id>` → verifier contract phải allow-list (xem skill `stellar-security` K1) |
| M4 | MV3 **cấm remote code**: mọi JS trong gói, không `eval`, không nạp script từ CDN | Với ví đây còn là điểm bán: giám khảo/CWS đều thích. CSP mặc định của MV3 đã chặn — đừng nới |
| M5 | `default_locale` + thư mục `_locales/en|vi|zh_CN/messages.json` cho tên/mô tả | CWS listing đọc từ đây, không đọc từ i18n runtime của app |

## 2 · Service worker phù du — cột sập nhiều nhất

SW của MV3 **ngủ khi rảnh** (thường ~30s không việc). Mọi giả định "app chạy nền" đều sai ở đây.

| Cần | Cấm | Thay bằng |
|---|---|---|
| Giữ trạng thái | Biến toàn cục trong SW | `chrome.storage.local` (~10MB) / `chrome.storage.session` (RAM, mất khi restart — hợp cho session unlock) |
| Việc định kỳ | `setInterval` trong SW | `chrome.alarms` (tối thiểu ~30s/lần) |
| Realtime | WebSocket sống mãi trong SW | Nối lại khi popup/side panel mở; nền thì poll qua alarms. Push tới SW extension: có đường (Web Push trong SW MV3) nhưng **verify bản Chrome hiện tại trước khi đặt cược** — baseline an toàn là alarms-poll + đếm badge |
| Báo guardian | — | `chrome.action.setBadgeText` (số đỏ) + `chrome.notifications` có nút hành động ("Duyệt" / "VETO") |

Popup bị **đóng là unmount sạch** (bấm ra ngoài là mất) → thao tác dài (chờ ký, chờ submit) phải chạy tiếp ở SW + ghi tiến độ vào storage, popup mở lại thì đọc tiếp. **Side Panel API** hợp cho phiên guardian dài hơi vì không tự đóng.

## 3 · Bảo mật riêng extension

- `chrome.storage` **KHÔNG mã hoá**. Với ví passkey thì không có seed để mất (điểm ăn MetaMask — nói to lên), nhưng session token/cache số dư vẫn phải TTL + xoá khi lock.
- Provider (đường B): tách **content script** (isolated world) và **injected script** (page world), nói chuyện qua `postMessage` **có kiểm `event.origin` + nonce**; mọi yêu cầu ký từ dApp phải mở popup hiện rõ **origin của dApp + nội dung tx đã decode** — chống trang giả mạo xin ký mù.
- Permission theo site: bảng `origin → quyền đã cấp`, thu hồi được từng site.
- Signer của extension trong smart account = **quyền hẹp** (duyệt guardian + gửi dưới hạn mức, không đổi policy) — xem skill `stellar-passkey-smart-account`. Máy tính bẩn hơn điện thoại, extension bị chiếm cũng chỉ làm được trong hộp đó.

## 4 · Chrome Web Store — ví crypto bị soi riêng

- Chuẩn bị sẵn: privacy policy URL, khai data-usage (limited use), mô tả single-purpose rõ, justification cho từng permission. Ví/crypto thường bị review tay → tính **ngày-tới-tuần**, không phải giờ.
- CWS có đợt siết policy hiệu lực **01/08/2026** — đọc bản cập nhật chính thức trước khi nộp, đừng nộp theo trí nhớ.
- **Demo/thi: "Load unpacked" là đủ** — nộp store là việc song song, không nằm trên đường găng. Key cố định (M1) đảm bảo ID lúc dev = ID lúc lên store → origin không đổi, passkey không gãy.
- Update tự động qua store; bản unpacked phải tự nhắc update tay.

## 5 · Bảng lỗi kinh điển

| Triệu chứng | Gốc | Fix |
|---|---|---|
| Passkey ký được hôm qua, hôm nay verifier từ chối | Load lại unpacked không có `key` → ID đổi → origin đổi | M1: key cố định từ commit đầu |
| `navigator.credentials` reject trong extension | Thiếu `host_permissions` đúng domain, hoặc Chrome < 122 | M2+M3 |
| Badge không cập nhật khi popup đóng | Đợi WebSocket trong SW đã ngủ | alarms-poll ghi storage, badge set từ SW |
| Đang ký thì bấm ra ngoài → mất luồng | Popup unmount | Tiến độ ở SW+storage; hoặc dùng Side Panel |
| Nộp CWS bị treo lâu | Ví crypto review tay + permission thừa | Permission tối thiểu + policy/privacy đủ + demo bằng unpacked trong lúc chờ |
| dApp không thấy ví | Tự chế API riêng | Cài module Wallets Kit (mục 0.B) |

## Cổng nghiệm thu cứng
1. Tắt/mở Chrome, load lại extension → ID không đổi. 2. Passkey tạo trên web ký được trong extension, verifier testnet nhận. 3. Đóng popup giữa lúc submit → mở lại thấy kết quả đúng, không double-submit. 4. Badge nhảy số khi có yêu cầu guardian mà popup đang đóng. 5. `_locales` đủ 3 tiếng.
