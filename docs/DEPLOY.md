# DEPLOY — go-live checklist (PHA 9.2 deploy-readiness)

> Chuẩn bị để lúc CÓ KEY MAINNET + DOMAIN chỉ việc chạy — mọi thứ dưới đây làm được
> không cần key. PARK thật: 9.2 mainnet cần key + domain. Cập nhật 2026-07-24.

## Thứ tự deploy (bắt buộc — origin-verifier với origin THẬT đi TRƯỚC)

1. **origin-verifier production** — deploy instance MỚI pin rpIdHash domain thật + allow-list
   3 origin (web/APK/extension). Bản testnet hiện tại là DEV localhost, KHÔNG dùng cho prod.
   Script: `contracts/scripts/deploy-origin-verifier.sh` (tham số hoá — xem dưới).
2. **smart-account** — wasm đã upload (hash `78e7521f…`). Mỗi ví là một instance mở bằng
   constructor (verifier = origin-verifier prod ở bước 1). **Constructor phải chở mục đặt chỗ
   registry** (`FwConstructorEntry::RecoveryRegistry`) — thiếu là ví deploy ra không khôi phục
   được. FE làm việc này ở `features/wallet/lib/recovery-link.ts`.
3. **recovery-registry v2** + **web-auth (SEP-45)** — deploy instance mainnet.
4. **BE** — env mainnet (passphrase `Public Global Stellar Network ; September 2015`, RPC mainnet,
   ví phí MAINNET MỚI, CONTRACT_ID_* trỏ instance mainnet, CONTRACT_ID_SAC_NATIVE mainnet).
5. **FE** — VITE_STELLAR_* mainnet, VITE_WEBAUTHN_VERIFIER_ADDRESS = origin-verifier prod,
   VITE_ACCOUNT_WASM_HASH = `78e7521f…`, VITE_RECOVERY_REGISTRY_ADDRESS = registry mainnet,
   rpId = domain thật.

## 3 origin phải allow-list trong origin-verifier prod (luật K1)

| Vỏ | Origin | Nguồn |
|---|---|---|
| Web | `https://<domain-thật>` | domain deploy FE (chưa có → HUMAN-TODO) |
| APK | `android:apk-key-hash:EeIRMfosA0YknpwuGr3ULGIb9qIlUuSPV7_DS8kmx9U` | ✅ ĐÃ SINH 2026-07-25 — xem §Keystore dưới |
| Extension | `chrome-extension://aakakeieeijeflbnblolnlhmooibddmc` | **key cố định đã chốt** (manifest, PHA 9.1) |

### Keystore phát hành Android (sinh 2026-07-25)

Verifier **KHÔNG có hàm cập nhật allow-list** — `allowed_origins` chỉ nhận ở constructor
(`contracts/origin-verifier/src/lib.rs:53`). Nên fingerprint APK phải có TRƯỚC khi deploy
verifier production, kể cả khi chưa build APK. Đã sinh sẵn:

| Mục | Giá trị |
|---|---|
| Vị trí | `~/family-wallet-release-keys/` (NGOÀI repo, `chmod 700`) |
| Keystore | `release.p12` (PKCS12 — Play chấp nhận; mật khẩu tạm `CHANGE_ME_BEFORE_USE`) |
| SHA-256 (dạng `keytool -printcert`) | `11:E2:11:31:FA:2C:03:46:24:9E:9C:2E:1A:BD:D4:2C:62:1B:F6:A2:25:52:E4:8F:57:BF:C3:4B:C9:26:C7:D5` |
| `android:apk-key-hash` | `EeIRMfosA0YknpwuGr3ULGIb9qIlUuSPV7_DS8kmx9U` |

Sinh bằng `openssl` (máy build không có `keytool`/JDK). Kiểm lại bất cứ lúc nào:

```bash
openssl x509 -in ~/family-wallet-release-keys/release-cert.pem -outform DER   | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '='
```

⚠️ **BA việc người phải làm trước khi dùng thật:**
1. **Đổi mật khẩu keystore** (`CHANGE_ME_BEFORE_USE` là giá trị đặt chỗ) và chuyển file vào
   nơi cất khoá thật của bạn — thư mục home của máy build không phải chỗ cất khoá phát hành.
2. **Sao lưu.** Mất keystore sau khi deploy verifier = phải deploy verifier MỚI (fingerprint
   đổi → allow-list cũ vô dụng) và mọi passkey đã tạo theo verifier cũ thành rác.
3. Nếu muốn dùng khoá do máy khác sinh (HSM, Play App Signing) thì **sinh trước, lấy
   fingerprint, thay hai dòng trên** — đừng deploy verifier rồi mới đổi khoá.

⚠️ Extension ID trên là CỐ ĐỊNH nhờ `key` trong `extension/manifest.json` — không đổi giữa
dev/store. Private key sinh ra NẰM NGOÀI repo (scratchpad, chỉ cần để tự-host .crx; CWS + unpacked
không cần). Sinh lại nếu mất: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | base64 -A`
→ thay `key` → **ID đổi → phải cập nhật allow-list này**.

## Contract on-chain hiện có (testnet) — cái nào ĐANG DÙNG

| Contract | ID / hash | Trạng thái |
|---|---|---|
| recovery-registry **v2.2** (2026-07-27) | `CDDOCXZ3OWM5TAQCRBKELETTIHQZD5NL3SF564VMD63MVJOGFV27F4Q3` | **ĐANG DÙNG** (env CONTRACT_ID_RECOVERY) — build từ main `1c9435e`, đủ B-SEC-1 + floors P0-2/P0-3 |
| smart-account wasm (2026-07-27) | hash `2c19ee49d7f25a6a052e2dc16489e5b1b10afc322ff6a8a8483d0e408c796f35` | **ĐANG DÙNG** (VITE_ACCOUNT_WASM_HASH + BE ACCOUNT_WASM_HASH) |
| origin-verifier PROD-pin (2026-07-27) | `CAYJGXLB5J23S6DYFWS5VTFRVCEN5NLIUJCTO6GTM6LDQOYB7J6EOYQS` | **ĐANG DÙNG** (VITE_WEBAUTHN_VERIFIER_ADDRESS) — rpId `familyhaven.mscilabs.com`, 3 origin web/api/extension, constructor fail-closed `InvalidOrigin=8` |
| web-auth SEP-45 (2026-07-27) | `CCSIOPPEPX6ZGT2KWDVQK7WC27VSIIAXZFKKZVYGFI2N3D3ZVUN57F5O` | **ĐANG DÙNG** (SEP45_WEB_AUTH_CONTRACT_ID + GitHub var WEB_AUTH_CONTRACT_ID) |
| verifier-ed25519 (2026-07-27) | `CBKTEIWOTZEEQWCJQRGGBWIJJX4DPDKPDF47VIOY3YORTSZVS5BPHDGK` | DÙNG cho e2e / khoá lạnh (không WebAuthn) |
| SAC native (XLM) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | built-in giao thức (DÙNG cho send); mainnet id khác |
| ~~recovery-registry v2.1 `CAFU4CZN…`~~ | ~~`CAFU4CZNPN5YWFV3QOCA4Y6FSJUB7IGI456MIGTQRJXA4DQLWUIHFMCO`~~ | BỎ 2026-07-27 (thiếu vá B-SEC-1 shape mới) |
| ~~recovery-registry v2.0~~ | ~~`CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY`~~ | BỎ (không TTL keeper) |
| ~~recovery-registry v1~~ | ~~`CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V`~~ | BỎ (classic-model — audit P0) |
| ~~smart-account wasm `78e7521f…`~~ | ~~hash `78e7521f391123c2dc119bdf2c3ecae1a4655fbf360e5c2a17fd12be028da170`~~ | BỎ 2026-07-27 (trước vá B-SEC-1) |
| ~~smart-account wasm P0 tạm~~ | ~~hash `d86d927e4b900e56904676afb7df0253dd337d30f7ac9baa444952e96683572f`~~ | BỎ |
| ~~smart-account wasm cũ hơn~~ | ~~hash `a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25`~~ | BỎ — ví bản này KHÔNG khôi phục được |
| ~~smart-account wasm cũ~~ | ~~hash `87194f6100c81fd5c290ca6a28034bc9ef2f6e42b2f7e73eefae37d5ad3b02a8`~~ | BỎ |
| ~~verifier-ed25519 cũ~~ | ~~`CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT`~~ | BỎ 2026-07-27 (redeploy cùng wasm — dùng bản mới cho đồng bộ đợt) |
| ~~origin-verifier DEV~~ | ~~`CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N`~~ | BỎ 2026-07-27 — DEV localhost, đã thay bằng bản pin domain thật |
| ~~web-auth cũ~~ | ~~`CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST`~~ | BỎ 2026-07-27 (redeploy đồng bộ đợt) |
| ~~verifier-webauthn spike~~ | ~~`CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP`~~ | spike gate-3, không nối app |

Bảng tx hash + ledger đợt 2026-07-27: `docs/security/AUDIT-2026-07-25.md` §8. Đợt cũ: `docs/evidence/TESTNET.md`
(giữ nguyên làm bằng chứng lịch sử — MỌI ID trong đó đã BỎ, xem bảng trên).

## TTL / state archival (ĐÃ DỰNG 2026-07-24 — trước đó KHÔNG tồn tại ở đâu)

> **Đính chính 2026-07-25 — mức độ nghiêm trọng thấp hơn ghi ban đầu.** Từ
> Protocol 23 (CAP-0066) entry archive được TỰ ĐỘNG khôi phục khi nằm trong
> footprint của `InvokeHostFunctionOp`, nên quên gia hạn KHÔNG làm mất ví —
> chỉ phát sinh phí khôi phục ở lần dùng tiếp theo. Cron dưới đây là tối ưu
> phí. Chi tiết + hướng dẫn cho người thừa kế: `docs/INHERITANCE.md`.

- `extend_ttl` có ở CẢ HAI contract; registry còn gia hạn mỗi lần ĐỌC (khuôn OZ).
- Cron `be/src/jobs/ttl-keeper.ts` — 03:00 UTC hằng ngày, ví phí trả, lỗi một ví không
  làm hỏng lượt của ví khác. Worker đã đăng ký trong `src/workers/index.ts`.
- ⚠️ CÒN THIẾU: job báo động entry SẮP hết TTL (mới có gia hạn, chưa có cảnh báo khi
  gia hạn thất bại nhiều ngày liên tiếp) — xem BLOCKERS.

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
