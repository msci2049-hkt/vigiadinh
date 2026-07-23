---
name: fw-passkey-auth
description: "Passkey (WebAuthn/Face ID/vân tay) cho FamilyWallet trên web Vite và mobile Capacitor — tạo ví không seed phrase, ký giao dịch Stellar bằng passkey (secp256r1), phân vai với Better Auth. Dùng skill này khi đụng đến: passkey, WebAuthn, navigator.credentials, biometric, Face ID, vân tay, secp256r1, smart-account-kit, passkey-kit, rpId, assetlinks.json, apple-app-site-association, đăng nhập không mật khẩu, ký giao dịch bằng sinh trắc học."
---

# FamilyWallet — Passkey

## PHÂN VAI — hiểu sai là hỏng kiến trúc
- **Passkey** = danh tính KÝ GIAO DỊCH on-chain (secp256r1, Stellar Protocol 21). Private key nằm trong secure enclave của máy, đồng bộ qua iCloud Keychain / Google Password Manager.
- **Better Auth** = PHIÊN APP (cookie) — biết user là ai để trả dữ liệu presence/notification. **Tuyệt đối không đụng custody.** Backend sập, user vẫn ký được giao dịch.
- Hai lớp độc lập: đăng nhập app ≠ quyền tiêu tiền.

## THƯ VIỆN
- Client ký Stellar: `kalepail/smart-account-kit` (SDK trên nền OpenZeppelin Smart Accounts; passkey + ed25519 + policy). Fallback demo: `passkey-kit` (legacy, không audit — chỉ demo).
- Server verify WebAuthn (đăng ký passkey làm phiên app): `@simplewebauthn/server` chạy trên Bun/Hono.
- Fee sponsor để user không cần XLM: OpenZeppelin Relayer (Launchtube đã bị khai tử).

## LUỒNG TẠO VÍ (không seed phrase)
1. `navigator.credentials.create()` — rpId = domain sản phẩm, user.name = tên hiển thị.
2. Lấy public key secp256r1 từ attestation → tạo/deploy smart account (Phase 3) hoặc map vào account classic (Phase 1–2: passkey chỉ là phiên app, ký vẫn qua Freighter/LOBSTR — ghi rõ trạng thái phase trong code).
3. KHÔNG BAO GIỜ hiển thị, log, hay export private key — nó không rời enclave.

## LUỒNG KÝ
`navigator.credentials.get()` với challenge = hash tx → chữ ký secp256r1 → nhét vào auth entry của smart account. Trên Capacitor: plugin `@capgo/capacitor-passkey` shim đúng API `navigator.credentials` — code web GIỮ NGUYÊN.

## rpId — chỗ chết người nhất
- Web: rpId = domain (vd `familywallet.app`). Đổi domain = mất toàn bộ passkey → chọn domain trước khi có user thật.
- Android: host `/.well-known/assetlinks.json` với SHA-256 cert fingerprint của app.
- iOS: host `/.well-known/apple-app-site-association` với `webcredentials:familywallet.app` trong entitlements.
- Thiếu 2 file trên = passkey chạy web nhưng CHẾT trên app — test sớm (gate P0-M1 trong skill capacitor).

## GUARDIAN KHÔNG CÀI GÌ
Guardian duyệt qua link web (SEP-7 hoặc link app) → trang duyệt chạy passkey ngay trong trình duyệt điện thoại. Không bắt guardian cài extension. LOBSTR Vault là đường dự phòng cho người đã có ví Stellar.

## CHECKLIST NGHIỆM THU
- [ ] Tạo passkey + ký được trên: Chrome desktop, Safari iOS, Chrome Android (web) — rồi mới tới app.
- [ ] Mất backend → vẫn ký được giao dịch (test tắt API).
- [ ] Recovery flow không phụ thuộc passkey cũ (mất máy = mất passkey local; iCloud sync là tiện, KHÔNG phải cơ chế khôi phục — cơ chế khôi phục là guardian).
- [ ] Không có đường code nào serialize private key.
