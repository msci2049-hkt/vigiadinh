---
name: vi-capacitor-apk
description: >
  Bọc SPA ví thành APK Android bằng Capacitor 8: bảng version chuẩn (SDK 36, AGP 8.13, Node 22),
  passkey native qua @capgo/capacitor-passkey + assetlinks.json (cert debug LẪN release), secure
  storage Keystore, FCM silent push cho presence-ping, nút VETO trên notification, deep link, và đường
  phát hành (APK trực tiếp cho demo, AAB + khai báo tài chính cho Play). Dùng khi: cap add android,
  build/ký APK, passkey không chạy trong app, push không tới, thiết lập App Links/assetlinks, lên
  Google Play, hay quyết định Capacitor vs React Native. Trigger: Capacitor, APK, AAB, Android,
  assetlinks, keystore, cap sync, gradle, FCM, silent push, biometric, WebView, Play Store.
---

# Vỏ APK Capacitor 8 — bọc đúng bản dist của web

Luật gốc: `apps/mobile` bọc **đúng bản build Vite của web** — không có source riêng. Mọi khác biệt
đi qua `PlatformAdapter`. Skill `calling-pro` (cùng bộ) đã cover gọi thoại/push nền sâu — đừng lặp lại.

## 1 · Bảng version — chép nguyên, đừng sáng tạo

| Mục | Giá trị (Cap 8) |
|---|---|
| minSdkVersion | 24 |
| compileSdk / targetSdk | 36 |
| AGP / Gradle wrapper | 8.13.0 / 8.14.3 |
| Node / JDK | 22+ / 17+ (khuyến nghị 21) |
| Android Studio | Otter 2025.2.1+ |
| iOS (sau này) | Deployment target 15, **SPM mặc định** — CocoaPods Specs read-only từ 12/2026, đừng đầu tư vào Pods |

Target SDK **khoá theo major Capacitor** — không tự nâng lẻ. Google bump yêu cầu hằng năm (~31/8) → kế hoạch nâng Cap major mỗi năm là việc vận hành, không phải lựa chọn.

## 2 · Passkey native — chuỗi phải đúng 100%, sai một mắt là im lặng fail

```
1. Host https://<domain>/.well-known/assetlinks.json
   → SHA-256 fingerprint của CẢ HAI cert: debug VÀ release   ◄ quên release = build ký thật chết
2. capacitor.config.ts:
   plugins.CapacitorPasskey = { origin: 'https://<domain>', autoShim: true, domains: ['<domain>'] }
3. cap sync  → plugin tự vá host project (asset_statements Android, entitlements iOS sau này)
4. Bootstrap app, TRƯỚC mọi lời gọi WebAuthn:  await CapacitorPasskey.autoShimWebAuthn()
5. Code web giữ nguyên navigator.credentials.create/get — shim chuyển sang API native
```

Plugin **không** sinh challenge hộ (challenge vẫn dẫn xuất từ tx — skill `stellar-security` K2) và
**không** làm origin Android thành HTTPS: origin ký ra là `android:apk-key-hash:<sha256-cert>` →
verifier phải allow-list (skill `stellar-passkey-smart-account` §1). **Đổi cert ký = đổi origin = chữ ký cũ
không tái tạo được trên bản mới** — giữ keystore release như giữ vàng, upload key Play cũng ghi sổ.

Lỗi kinh điển đã có người trả giá:
| Triệu chứng | Gốc | Fix |
|---|---|---|
| `PublicKeyCredential is undefined` | Chưa gọi `autoShimWebAuthn()` trước khi dùng | Đưa lên bootstrap, await xong mới render |
| `NotAllowedError` (iOS WKWebView) | Thiếu associated domains / gọi ngoài user gesture | AASA + gọi trong handler bấm nút |
| Passkey lặng lẽ không hiện prompt | assetlinks sai fingerprint / sai package / CDN cache bản cũ | `curl` file trực tiếp, so fingerprint bằng `keytool -list -printcert` |
| Chạy debug OK, bản release chết | assetlinks chỉ khai cert debug | Khai cả hai từ đầu |

## 3 · Adapter riêng vỏ APK

| Khả năng | Dùng | Ghi chú |
|---|---|---|
| Secure storage | `@capacitor-community/secure-storage` | Keystore/Keychain; chỉ session key + share Shamir guardian — **không có seed để lưu**, đừng tự chế chỗ chứa secret |
| Cổng sinh trắc mở app | `capacitor-native-biometric` | Gate mở app ≠ ký giao dịch (ký = passkey ceremony riêng, đừng gộp) |
| Push | `@capacitor/push-notifications` (FCM) | **Silent push** cho presence-ping 12:00 chạy nền không phiền người; notification category có **nút hành động "VETO ngay"** cho cảnh báo recovery |
| Deep link | scheme `vigiadinh://` + App Links HTTPS | Link mời guardian, link ký SEP-7 |
| Camera/mic | `@capacitor/camera` + permission mic | Quay lời nhắn cuối — mã hoá tại máy trước upload |
| Edge-to-edge | SystemBars (mới của Cap 8) | Android 15+ full-screen mặc định; safe-area đã có bài trong `calling-pro` |

Cấm trong lõi: API chỉ-desktop (popup window flow, drag-drop file, clipboard cũ) — chỗ nào cần thì adapter hoá, đã có danh sách từ scan FE.

## 4 · Phát hành

- **Demo/thi: APK ký release tải trực tiếp.** Bỏ toàn bộ khâu duyệt — một ngày thay vì hai tuần. QR tải + hướng dẫn bật "nguồn không xác định".
- **Play:** bắt **AAB**; ví crypto khai form **Financial features** + data-safety (ghi thẳng: không thu hành vi raw, di chúc mã hoá server không đọc được — đây là điểm cộng, khai cho đủ đậm); Internal testing → Closed → Production. Review ví thường lâu hơn app thường.
- Icon/splash/screenshot ×3 ngôn ngữ; `values/`, `values-vi/`, `values-zh-rCN/strings.xml` cho tên app + text quyền (skill `vi-i18n-en-vi-zh` §5).

## 5 · Gate P0-M1 — cửa thoát Capacitor (2 ngày, đầu phase mobile)

Passkey **tạo + ký chạy thật** trên: 1 máy Android tầm trung (Xiaomi/Oppo thật, không emulator) + 1 iPhone.
Fail sau khi đã làm đúng §2 → **đổi React Native, đừng cố** — biometric/passkey trên RN chín hơn, đây là
điểm yếu đã biết của Capacitor và đã ghi trong tài liệu dự án. Điều kiện lật quyết định viết ra trước, không cãi sau.

## Cổng nghiệm thu cứng
1. Passkey tạo trên web → ký được trong APK bản **release** trên máy thật. 2. Silent push presence tới khi app killed (test máy OEM giá rẻ — bài học calling-pro). 3. Notification VETO bấm được từ màn khoá → veto ghi nhận. 4. `assetlinks.json` trả đúng qua curl với cả 2 fingerprint. 5. APK tải trực tiếp cài chạy trên máy chưa từng cài bản debug.
