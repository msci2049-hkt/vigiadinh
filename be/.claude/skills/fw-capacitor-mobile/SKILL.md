---
name: fw-capacitor-mobile
description: "Đóng gói FamilyWallet từ web Vite thành app Android/iOS bằng Capacitor: passkey plugin, secure storage, push FCM/APNs, biometric gate, deep link, gate quyết định P0-M1, checklist lên Play Store và App Store. Dùng skill này khi đụng đến: Capacitor, build mobile, Android, iOS, APK, IPA, cap add, cap sync, push notification mobile, FCM, APNs, secure storage mobile, biometric app, deep link, app store, play store, TestFlight."
---

# FamilyWallet — Capacitor Mobile

Một codebase Vite → web + Android + iOS. Capacitor bọc đúng bản build web; khác biệt nằm ở plugin native và cấu hình store.

## GATE P0-M1 — chạy TRƯỚC khi cam kết Capacitor (2 ngày, đầu Phase 2)
Trên 1 Android tầm trung (WebView cũ) + 1 iPhone thật:
- [ ] Tạo passkey + ký thành công qua `@capgo/capacitor-passkey`
- [ ] Silent push đánh thức app ở background (Doze/Low Power bật)
- [ ] Secure storage đọc/ghi sau khi kill app
**Bất kỳ mục nào fail không sửa được trong 2 ngày → đổi React Native ngay, đừng cố.** (Điểm yếu đã biết: biometric/passkey plugin của Capacitor kém chín hơn RN — đây là gate, không phải hy vọng.)

## SETUP
```bash
bun add @capacitor/core @capacitor/android @capacitor/ios
bun add @capgo/capacitor-passkey @capacitor-community/secure-storage @capacitor/push-notifications capacitor-native-biometric
bunx cap init familywallet app.familywallet --web-dir=dist
bunx cap add android && bunx cap add ios
# vòng lặp: bun run build && bunx cap sync && bunx cap open android|ios
```
`capacitor.config.ts`: `server.androidScheme='https'` (WebAuthn cần secure context), khai `plugins.CapacitorPasskey` theo doc plugin.

## PASSKEY TRÊN APP — 2 file quyết định sống chết
- Android: host `https://<domain>/.well-known/assetlinks.json` chứa package `app.familywallet` + SHA-256 fingerprint cert ký (LẤY TỪ CERT PHÁT HÀNH của Play Console, không phải debug cert — sai cái này passkey chết chỉ trên bản store).
- iOS: `https://<domain>/.well-known/apple-app-site-association` + entitlement `webcredentials:<domain>`.
- rpId trong code = domain đó, khớp tuyệt đối. Test trên bản release-sign, không chỉ debug.

## PUSH — hai loại, hai mục đích
- **Hiện thông báo** (VETO khẩn, yêu cầu duyệt): notification message; category có nút hành động "VETO ngay" / "Xem yêu cầu" (deep link `familywallet://recovery/<id>`).
- **Silent ping 12:00** (presence): FCM data-only + APNs `content-available:1`; handler chạy nền gọi `/presence/ack`. iOS bóp silent push mạnh — đừng hứa realtime, ngưỡng offline 72h đã tính chuyện này.
Token push đăng ký lại mỗi lần mở app, gửi kèm device fingerprint về `devices`.

## SECURE STORAGE & BIOMETRIC GATE
- `@capacitor-community/secure-storage` (AES-256, Keychain/Keystore): giữ session key, Shamir share device-key, K của owner. KHÔNG dùng localStorage/Preferences cho bất kỳ thứ nhạy cảm nào.
- `capacitor-native-biometric` gate mở app + trước mỗi hành động ký. Fallback passcode hệ thống, không tự chế PIN.

## KHÁC BIỆT WEB↔APP PHẢI XỬ
- Không dùng API chỉ-desktop (window.open popup OAuth, hover). Camera/mic (quay lời nhắn cuối): `@capacitor/camera` + permission trong Info.plist / AndroidManifest kèm mô tả lý do — thiếu mô tả là Apple reject.
- Deep link + Universal Links/App Links cho link mời guardian: mở app nếu có, rơi về web nếu chưa cài.
- Safe area (notch): dùng `env(safe-area-inset-*)` — mockup 41 màn đã theo chuẩn này.

## STORE CHECKLIST
- [ ] Icon + splash sinh bằng `@capacitor/assets`; screenshot 2 store theo size bắt buộc
- [ ] Privacy policy URL + Data Safety (Play) / Privacy Nutrition (Apple): khai "không thu hành vi raw, di chúc mã hóa server không đọc được, không bán dữ liệu"
- [ ] Apple: app crypto-wallet → khai export compliance (dùng encryption chuẩn, exempt); KHÔNG nhắc "trading" trong mô tả để tránh bị xếp nhầm sang tài chính cần license
- [ ] Android: `targetSdk` mới nhất Play yêu cầu; ký bằng Play App Signing
- [ ] Vòng phát hành: Internal testing (Play) + TestFlight (iOS) ≥2 tuần với ≥10 gia đình thử trước public
- [ ] Bản build store chạy lại toàn bộ gate P0-M1 (cert phát hành ≠ cert debug)
