# DEPLOY — go-live checklist (PHA 9.2 deploy-readiness)

> Chuẩn bị để lúc CÓ KEY MAINNET + DOMAIN chỉ việc chạy — mọi thứ dưới đây làm được
> không cần key. PARK thật: 9.2 mainnet cần key + domain. Cập nhật 2026-07-24.

## Thứ tự deploy (bắt buộc — origin-verifier với origin THẬT đi TRƯỚC)

1. **origin-verifier production** — deploy instance MỚI pin rpIdHash domain thật + allow-list
   3 origin (web/APK/extension). Bản testnet hiện tại là DEV localhost, KHÔNG dùng cho prod.
   Script: `contracts/scripts/deploy-origin-verifier.sh` (tham số hoá — xem dưới).
2. **smart-account** — wasm đã upload (hash `a67ea40e…`, bản có recovery hook). Mỗi ví là một
   instance mở bằng constructor (verifier = origin-verifier prod ở bước 1).
3. **recovery-registry v2** + **web-auth (SEP-45)** — deploy instance mainnet.
4. **BE** — env mainnet (passphrase `Public Global Stellar Network ; September 2015`, RPC mainnet,
   ví phí MAINNET MỚI, CONTRACT_ID_* trỏ instance mainnet, CONTRACT_ID_SAC_NATIVE mainnet).
5. **FE** — VITE_STELLAR_* mainnet, VITE_WEBAUTHN_VERIFIER_ADDRESS = origin-verifier prod,
   VITE_ACCOUNT_WASM_HASH = `a67ea40e…`, rpId = domain thật.

## 3 origin phải allow-list trong origin-verifier prod (luật K1)

| Vỏ | Origin | Nguồn |
|---|---|---|
| Web | `https://<domain-thật>` | domain deploy FE (chưa có → HUMAN-TODO) |
| APK | `android:apk-key-hash:<hash>` | SHA-256 cert PHÁT HÀNH Play Console (không phải debug) |
| Extension | `chrome-extension://aakakeieeijeflbnblolnlhmooibddmc` | **key cố định đã chốt** (manifest, PHA 9.1) |

⚠️ Extension ID trên là CỐ ĐỊNH nhờ `key` trong `extension/manifest.json` — không đổi giữa
dev/store. Private key sinh ra NẰM NGOÀI repo (scratchpad, chỉ cần để tự-host .crx; CWS + unpacked
không cần). Sinh lại nếu mất: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | base64 -A`
→ thay `key` → **ID đổi → phải cập nhật allow-list này**.

## Contract on-chain hiện có (testnet) — cái nào ĐANG DÙNG

| Contract | ID / hash | Trạng thái |
|---|---|---|
| recovery-registry **v2** | `CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY` | **ĐANG DÙNG** (env CONTRACT_ID_RECOVERY) |
| recovery-registry v1 | `CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V` | BỎ (classic-model, không xoay khoá — audit P0) |
| smart-account wasm | hash `a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25` | **ĐANG DÙNG** (bản có recovery hook) |
| smart-account wasm cũ | hash `87194f6100c81fd5c290ca6a28034bc9ef2f6e42b2f7e73eefae37d5ad3b02a8` | BỎ (không có hook) |
| verifier-ed25519 | `CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT` | DÙNG cho e2e / khoá lạnh (không WebAuthn) |
| origin-verifier DEV | `CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N` | DEV localhost — thay bằng prod khi có domain |
| web-auth (SEP-45) | `CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST` | DÙNG (đăng nhập ví) |
| verifier-webauthn (spike) | `CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP` | spike gate-3 (SDK27), không nối app |
| SAC native (XLM) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | built-in giao thức (DÙNG cho send); mainnet id khác |

Bảng tx hash đầy đủ: `docs/evidence/TESTNET.md`.

## TTL / state archival (bắt buộc mainnet — sự cố production kinh điển)

- Cron `extend_ttl` cho mọi entry sống còn: smart-account instance + wasm + recovery-registry
  persistent keys. Quên = contract "biến mất" sau ~vài tuần/tháng (skill stellar-mainnet-deploy).
- Job báo động entry sắp hết TTL.

## Trước khi mở cho người dùng thật

- [ ] Soroban Security Audit Bank (report open-source bắt buộc) — đăng ký khi đủ điều kiện.
- [ ] Pin version mọi crate OZ; coi khung policy là chưa-audit tới khi có report đúng version.
- [ ] Threat model (`docs/THREAT-MODEL.md`) rà lại phần "còn hở" — origin-verifier prod, WebAuthn-kit.
- [ ] Ví phí mainnet nạp XLM đủ + giám sát số dư (fee-bump cho mọi tx người dùng).

## HUMAN-TODO (cần người/hạ tầng)

- Domain thật → rpId + 3 origin + well-known (assetlinks/AASA đã có template ở
  `fe/apps/web/public/.well-known/`, thay placeholder).
- Play Console → SHA-256 cert phát hành (assetlinks).
- Key mainnet ví phí + deployer (KHÁC testnet, KHÁC dev — luật security).
