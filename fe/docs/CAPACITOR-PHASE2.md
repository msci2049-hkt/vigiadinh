# Capacitor — CHƯA CÀI (Phase 2, có gate)

Prompt bootstrap ghi rõ: **chưa cài Capacitor** ở phase này. Ghi lại để không ai "tiện tay" thêm.

## Vì sao chờ

Gate **P0-M1** (PROJECT-BRIEF §6): thử **passkey + silent push trên MÁY THẬT trong 2 ngày**.
- Pass → đóng gói bằng Capacitor.
- Fail → đổi sang React Native.

Cài Capacitor trước khi chạy gate = tự khóa mình vào lựa chọn chưa được kiểm chứng.

## Khi mở Phase 2 thì đọc

`.claude/skills/fw-capacitor-mobile/SKILL.md` (đã có sẵn trong repo) + `fw-passkey-auth`.

## Bẫy phải giải quyết TRƯỚC khi đóng gói

- **rpId là vĩnh viễn**: đổi domain = mất toàn bộ passkey của người dùng. Chốt domain thật
  trước khi có user thật.
- **`/.well-known/assetlinks.json`** (Android, SHA-256 cert fingerprint) và
  **`/.well-known/apple-app-site-association`** (iOS, `webcredentials:<domain>`) phải host trên
  domain thật — thiếu thì passkey **chạy trên web nhưng CHẾT trong app**.
- Silent push: `firebase-admin` đã cài bên BE nhưng **chưa nối dây**; APNs cần cấu hình riêng.
- `pnpm build` (honest) rồi mới `cap sync` — `vite build` thường không tính là bằng chứng build.
