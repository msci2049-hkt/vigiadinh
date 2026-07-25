# HUMAN-TODO — việc con người phải làm để lên MAINNET

> Mọi thứ không cần key/domain đã chuẩn bị sẵn (DEPLOY.md + script tham số hoá).
> Tài liệu này liệt kê ĐÚNG các việc agent KHÔNG làm được — cần khoá thật hoặc
> quyết định của con người. Cho tới khi làm, app vẫn chạy đầy đủ trên **testnet**.
> Cập nhật 2026-07-24 (sau khi đóng mắt xích passkey on-chain).

## 0. MỘT BIẾN DUY NHẤT cần điền: DOMAIN

Toàn bộ cấu hình production khoá vào **một** giá trị — tên miền thật của bản web.
Chốt domain TRƯỚC khi có người dùng thật (đổi domain = mất sạch passkey đã tạo, vì
rpId = domain — luật K1). Khi có domain `<DOMAIN>` (vd `vigiadinh.com`):

```bash
# 1) Deploy origin-verifier production — pin rpIdHash + allow-list 3 origin.
cd contracts && stellar contract build
RP_ID=<DOMAIN> \
ORIGIN_WEB=https://<DOMAIN> \
ORIGIN_APK="android:apk-key-hash:EeIRMfosA0YknpwuGr3ULGIb9qIlUuSPV7_DS8kmx9U" \
ORIGIN_EXT="chrome-extension://aakakeieeijeflbnblolnlhmooibddmc" \
SOURCE=<alias-khoá-mainnet> NETWORK=mainnet \
./scripts/deploy-origin-verifier.sh
# → in ra địa chỉ verifier prod. Điền vào:
#   - fe/apps/web/.env  VITE_WEBAUTHN_VERIFIER_ADDRESS + VITE_PASSKEY_RP_ID=<DOMAIN>
#   - docs/DEPLOY.md bảng contract (đổi origin-verifier DEV → prod)
#   - fe/apps/web/deploy/nginx.conf CSP connect-src (origin BE thật)
#   - public/.well-known/assetlinks.json + apple-app-site-association (khi có APK/iOS)
```

Hai origin phụ (APK, extension) đã CÓ SẴN giá trị — không còn chờ ai:
- **APK**: fingerprint từ keystore đã sinh 2026-07-25 (`docs/DEPLOY.md` §Keystore). Nếu bạn
  muốn dùng khoá khác (Play App Signing / HSM) thì **thay giá trị TRƯỚC khi deploy verifier** —
  allow-list nạp lúc deploy và không sửa được sau đó.
- **Extension**: ID `aakakeieeijeflbnblolnlhmooibddmc` đã CỐ ĐỊNH (key trong manifest) —
  không cần đổi giữa dev/store.

## 1. Sinh ví phí MAINNET MỚI (bắt buộc — không tái dùng)

5 seed testnet đã lộ trong quá trình build → **CẤM dùng trên mainnet vĩnh viễn**.
Sinh khoá mới, nạp XLM đủ để fee-bump mọi giao dịch người dùng, giám sát số dư:

```bash
stellar keys generate deployer-mainnet --network mainnet   # KHÔNG in secret ra chat/log
# nạp XLM, điền địa chỉ vào BE env FEE_WALLET_SECRET (qua vault, KHÔNG commit)
```

## 2. Deploy instance mainnet các contract còn lại

Theo thứ tự trong `docs/DEPLOY.md` §"Thứ tự deploy": origin-verifier prod (bước 0) →
smart-account wasm (hash `a67ea40e…`) → recovery-registry v2 → web-auth (SEP-45) →
BE env mainnet → FE env mainnet. Cập nhật `docs/DEPLOY.md` bảng contract với id mainnet.

## 3. TTL / archival cron (sự cố production kinh điển nếu quên)

Bật cron `extend_ttl` cho smart-account instance + wasm + recovery-registry persistent
keys + job báo động sắp hết TTL (skill stellar-mainnet-deploy). Quên = contract "biến
mất" sau vài tuần/tháng.

## 4. Đọc kết quả CI GitHub Actions (máy build không có gh/token — B-CI-1)

Mở `https://github.com/msci2026vn/family-wallet/actions` xác nhận 4 workflow xanh sau
push (ci-be, ci-fe gồm job e2e, ci-contracts, secret-scan). Máy dev thiếu `gh`/token
nên agent chỉ tái hiện được local — xem `BLOCKERS.md` §CI.

## 5. Nâng gitleaks local lên 8.30.1 (khớp CI — B-DEV-1)

```bash
curl -sL -o /tmp/g.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
tar -C /tmp -xzf /tmp/g.tar.gz gitleaks && mv /tmp/gitleaks ~/.local/bin/gitleaks
```

## 6. Trước khi mở cho người dùng thật

- [ ] Soroban Security Audit Bank (report open-source) — đăng ký khi đủ điều kiện.
- [ ] Pin version mọi crate OZ; khung policy coi là chưa-audit tới khi có report đúng version.
- [ ] Rà `docs/THREAT-MODEL.md` phần "còn hở" (origin-verifier prod, mainnet chưa lên).
- [ ] Chạy passkey e2e trên máy/browser THẬT (Chrome 122+, Safari iOS) — bản testnet đã
      chứng minh qua virtual authenticator (`docs/evidence/TESTNET.md §PASSKEY-ONCHAIN`),
      nhưng ký bằng sinh trắc học thật của người dùng thì cần thiết bị thật.
