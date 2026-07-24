# FamilyWallet — đóng gói mobile (Capacitor) · PHA 8

Một codebase Vite → web + Android + iOS. Capacitor bọc ĐÚNG bản `pnpm build` (honest),
khác biệt chỉ ở plugin native + cấu hình store (skill `fw-capacitor-mobile`).

> **Trạng thái:** cấu hình + tài sản well-known đã sẵn trong repo; **build APK/IPA CHƯA chạy**
> — máy build này không có JDK/Android SDK/Xcode. Đây là gate máy thật, không phải TODO bỏ ngỏ:
> mọi lệnh dưới đây chạy được trên máy có toolchain, không đụng gì tới bản web đang xanh.

## Vì sao chưa cài `@capacitor/*` vào package.json

Thêm dep mà KHÔNG install được (thiếu toolchain) sẽ phá `pnpm install --frozen-lockfile`
của CI web. Nên các lệnh cài nằm ở đây, chạy TRÊN máy có toolchain — lúc đó mới đổi lockfile
có chủ đích + validate lại (luật lockfile CLAUDE.md §3).

## GATE P0-M1 — chạy TRƯỚC khi cam kết Capacitor (2 ngày)

Trên 1 Android tầm trung (WebView cũ) + 1 iPhone thật:

- [ ] Tạo passkey + ký thành công qua `@capgo/capacitor-passkey`
- [ ] Silent push đánh thức app ở background (Doze/Low Power bật)
- [ ] Secure storage đọc/ghi sau khi kill app

Bất kỳ mục nào fail không sửa được trong 2 ngày → đổi React Native, đừng cố. Passkey/biometric
plugin của Capacitor kém chín hơn RN — đây là gate, không phải hy vọng.

## Setup (máy có toolchain)

```bash
cd fe/apps/web
pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
pnpm add @capgo/capacitor-passkey @capacitor-community/secure-storage \
         @capacitor/push-notifications capacitor-native-biometric
# capacitor.config.json đã có sẵn (appId app.familywallet, webDir dist, androidScheme https)
pnpm build                 # honest build → dist/
pnpm exec cap add android
pnpm exec cap add ios
# vòng lặp: pnpm build && pnpm exec cap sync && pnpm exec cap open android|ios
```

## Passkey trên app — 2 file quyết định sống chết (ĐÃ có template)

- **Android:** `apps/web/public/.well-known/assetlinks.json` — thay `__PLAY_APP_SIGNING_SHA256__`
  bằng SHA-256 cert **PHÁT HÀNH của Play Console** (KHÔNG phải debug cert — sai là passkey chết
  chỉ trên bản store). Lấy: Play Console → Setup → App signing → App signing key certificate.
- **iOS:** `apps/web/public/.well-known/apple-app-site-association` — thay `__APPLE_TEAM_ID__`
  bằng Team ID; entitlement `webcredentials:<domain>` trong Xcode.
- `rpId` trong code = domain host well-known, khớp tuyệt đối. Test trên bản release-sign.
- Verifier contract production phải allow-list origin `android:apk-key-hash:…` + `https://<domain>`
  (skill `stellar-security` K1) — origin-verifier hiện là bản DEV localhost, deploy instance
  production pin 3 origin thật khi có domain.

## Push — hai loại

- **Hiện thông báo** (VETO khẩn, yêu cầu duyệt): notification message + nút "VETO ngay" /
  "Xem yêu cầu" → deep link `app.familywallet://recovery/<id>` (AASA paths đã khai `/recovery/*`,
  `/guardian/*`, `/block/*`).
- **Silent ping 12:00** (presence): FCM data-only + APNs `content-available:1` → handler nền gọi
  `POST /api/presence/ack`. iOS bóp silent push mạnh — ngưỡng offline 72h (PHA 4) đã tính điều này.

## Secure storage & biometric gate

- `@capacitor-community/secure-storage` (Keychain/Keystore): session key + SEP-45 JWT.
  KHÔNG localStorage/Preferences cho thứ nhạy cảm. (Ví passkey KHÔNG có seed để mất — điểm mạnh.)
- `capacitor-native-biometric` gate mở app + trước mỗi hành động ký; fallback passcode hệ thống.

## Store checklist (song song, không nằm trên đường găng — demo bằng bản debug là đủ)

- [ ] Icon + splash `@capacitor/assets`; screenshot 2 store
- [ ] Privacy policy URL + Data Safety/Privacy Nutrition: "không thu hành vi raw, không bán dữ liệu"
- [ ] Apple export compliance (encryption chuẩn, exempt); KHÔNG dùng chữ "trading" trong mô tả
- [ ] Android `targetSdk` mới nhất Play yêu cầu; ký bằng Play App Signing
- [ ] Bản build store chạy LẠI toàn bộ gate P0-M1 (cert phát hành ≠ cert debug)
