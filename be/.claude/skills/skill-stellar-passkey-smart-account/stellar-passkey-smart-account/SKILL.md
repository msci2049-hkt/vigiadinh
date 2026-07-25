---
name: stellar-passkey-smart-account
description: >
  Trái tim ví không-seed-phrase trên Stellar: OpenZeppelin Smart Account (signers + context rules +
  policies), passkey WebAuthn qua verifier contract, smart-account-kit, OZ Relayer trả phí hộ, ủy quyền
  Zipper/CAP-0071, SEP-45 auth, và bài toán MỘT rpId - BA origin (web/APK/extension) với quyền riêng
  từng vỏ. Dùng khi: tạo ví smart account, thêm/gỡ signer, viết policy (threshold, spending limit,
  recovery, timelock), nối relayer tài trợ phí, thiết kế phiên đăng nhập contract account, hay debug
  chữ ký passkey bị verifier từ chối. Trigger: passkey, WebAuthn, smart account, smart wallet,
  __check_auth, context rule, policy, verifier, relayer, fee sponsor, CAP-0071, Zipper, SEP-45, signer.
---

# Passkey + Smart Account — danh tính và ký của cả dự án

Nguồn: OZ stellar-contracts (packages/accounts, audit RC v0.7.0, Certora đang formal-verify),
smart-account-kit (kalepail — kế thừa chính thức của passkey-kit), OZ Relayer docs, Zipper upgrade guide,
mẫu production Meridian Pay. **`passkey-kit` + `launchtube` là LEGACY — dự án mới cấm dùng.**

## 0 · Mô hình 3 mảnh (thuộc lòng trước khi code)

```
Smart Account (contract C…, cài CustomAccountInterface / __check_auth)
├─ SIGNERS  — ai được ký
│   ├─ External: public key + VERIFIER contract (passkey secp256r1, ed25519, secp256k1, BLS, RSA)
│   └─ Delegated: một địa chỉ Soroban bất kỳ ⚠️ phải TỰ CRAFT auth entry — simulation không trả về
├─ CONTEXT RULES — được làm gì (CallContract nào, CreateContract…), có `expiration`
│   └─ mỗi rule cần ≥1 signer HOẶC ≥1 policy; nhiều rule cùng context type được
└─ POLICIES — ràng buộc nghiệp vụ cắm vào rule
    ├─ có sẵn: threshold multisig · spending limit
    └─ tự viết: family_recovery (guardian vote + timelock) · inheritance (heartbeat + claim) · care (allowlist + ceiling)
```

`__check_auth` nhận `auth_contexts: Vec<Context>` — một entry cho mỗi `require_auth` trong tx.
Deploy smart account bằng **WASM hash + constructor args (signers, policies)** — KHÔNG có contract ID
cố định dùng chung; mỗi người dùng một instance.

## 1 · Một rpId — Ba origin — Ba bộ quyền (bảng gốc của dự án)

| Vỏ | `rpId` (ký trong `rpIdHash`) | `origin` (ký trong `clientDataJSON`) | Quyền signer đề xuất |
|---|---|---|---|
| Web | `vigiadinh.com` | `https://vigiadinh.com` | TOÀN QUYỀN |
| APK | `vigiadinh.com` (qua assetlinks) | `android:apk-key-hash:<sha256-cert>` | TOÀN QUYỀN |
| Extension | `vigiadinh.com` (qua host_permissions, Chrome 122+) | `chrome-extension://<id>` | **HẸP**: duyệt guardian ✓ · xem ✓ · gửi tới allowlist dưới hạn mức, rule `expiration` 30 ngày · đổi policy/guardian ✗ |

- Cùng `rpId` → **cùng credential**, đồng bộ sẵn qua Google Password Manager / iCloud → tạo passkey một lần, vỏ nào cũng ký được.
- Verifier: kiểm `rpIdHash` + **allow-list 3 origin**. Pin một origin = hai vỏ chết (chi tiết skill `stellar-security` K1–K2).
- Quyền hẹp cho extension không phải cẩn thận thừa: máy tính bẩn hơn điện thoại, và **mất laptop → gỡ đúng signer đó**, các vỏ khác sống bình thường. Đây là câu ăn điểm trước giám khảo: chiếm extension chỉ làm được trong hộp, MetaMask thì mất sạch.
- Nhiều domain web sau này: Related Origin Requests (`/.well-known/webauthn`, giới hạn cứng **5 nhãn**) — chỉ dựng khi thật cần.

## 2 · smart-account-kit — lắp thế nào

- Client: tạo/khôi phục passkey, session persistence, storage adapter (IndexedDB mặc định — vỏ extension viết adapter sang `chrome.storage`, vỏ APK sang secure storage), `SignerKey.Secp256r1 / Ed25519 / Policy`.
- Deploy: dùng **WASM hash upload sẵn** + verifier/policy address đã deploy (mẫu trong `demo/.env.example` của repo) → constructor args là signers+policies của người dùng.
- Có `StellarWalletsKitAdapter` → ví của mày xuất hiện trong Wallets Kit như mọi ví khác (khớp đường B của skill extension).
- `VITE_RELAYER_URL` cho luồng tài trợ phí — qua proxy backend, không gọi thẳng (mục 4).
- Pin version: khung còn mới. Ghi rõ commit/version trong STATUS; coi là chưa-audit cho tới khi có report đúng version.

## 3 · Zipper (Protocol 27 — mainnet 08/07/2026) khai thác gì

- **CAP-0071-01:** ủy quyền xác thực thành cơ chế cấp giao thức — mọi delegated signer gộp **một** authorization entry → tx nhỏ, rẻ, hết cảnh craft payload nhiều lượt simulation. Đúng thứ "gia đình nhiều người ký" cần, và mới ra vài tuần → giám khảo Stellar sẽ nhớ.
- **CAP-0071-02:** credential **AddressV2** gắn địa chỉ người ký → chặn replay chéo tài khoản. V1 còn sống nhưng thay ở P28 — dùng V2 ngay từ đầu. CLI mới có `--auth-mode` (`enforce`/`root`/`non-root`) + ký được AddressV2; `non-root` là thứ luồng guardian cần.
- `@stellar/stellar-base` đang gộp vào `@stellar/stellar-sdk` — import thẳng `stellar-base` là nợ, đổi ngay.

## 4 · Trả phí hộ — lời hứa "không cần giữ XLM"

- **OZ Relayer** (thay thế chính thức của Launchtube đã khai tử): plugin `@openzeppelin/relayer-plugin-channels`, endpoint `channels.openzeppelin.com/testnet`, API key. **Bắt buộc gọi phía server** — client dính CORS. Prod: signer qua Turnkey / GCP KMS, không local keystore.
- ⚠️ **Chặn tiềm tàng:** docs Relayer ghi sponsored transaction hiện chỉ hỗ trợ **classic asset (credit_alphanum4/12)**, token Soroban "bản sau". Ví này chạy contract account → **verify dòng này trước khi hứa với ai**. 
- **Phương án B luôn sẵn:** tự fee-bump — backend giữ MỘT ví phí riêng (chỉ XLM phí, không đụng custody), bọc fee-bump transaction cho tx người dùng đã ký. Đơn giản, không phụ thuộc ai; mất là mất tiền phí, không mất tiền người dùng.

## 5 · Phiên đăng nhập backend cho ví contract

- **SEP-45** = web auth cho **contract account** (SEP-10 chỉ cho G-account) → backend phát challenge, ví ký bằng `__check_auth`, đổi lấy JWT phiên. Gắn phiên với **địa chỉ ví + device**, không chỉ user id.
- SEP-30 recoverysigner: bản SDF tự khai **thực nghiệm, không khuyến nghị production** — mô hình recovery của dự án nằm ở policy on-chain rồi, đừng vác thêm SEP-30 vào.

## 6 · Ba spike gate — nửa ngày mỗi cái, chưa qua chưa được code sản phẩm

1. **Web → Extension:** tạo passkey trên web, `credentials.get({rpId})` từ trang extension → in `clientDataJSON.origin` thật.
2. **Web → APK:** cùng credential, get qua shim capgo, assetlinks đã host → in origin thật.
3. **Contract nuốt 3 origin:** ném cả 3 chữ ký vào verifier testnet. **Gate quyết định.** Fail → fork verifier thêm allow-list (1 ngày) hoặc chuyển mô hình signer-riêng-từng-vỏ (vẫn chạy được, thêm màn ghép QR).
Ghi kết quả vào `SPIKE-PASSKEY.md`: 3 chuỗi origin nguyên văn + verifier phản ứng gì. File này là input bắt buộc của mọi việc sau.

## Bảng lỗi kinh điển

| Triệu chứng | Gốc | Fix |
|---|---|---|
| Verifier từ chối chữ ký APK/ext, web thì OK | Verifier pin một origin | Allow-list 3 origin (gate 3) |
| Delegated signer "không thấy auth entry" | Simulation không trả entry cho delegated | Tự craft entry thủ công — đây là behavior, không phải bug |
| Sponsored tx fail với token Soroban | Giới hạn classic-asset của Relayer | Verify docs; fallback tự fee-bump (mục 4) |
| Passkey tạo xong, máy khác không thấy | Người dùng chưa bật sync GPM/iCloud | UI phải nói rõ + luôn giữ đường ghép thiết bị bằng guardian-invite |
| Đổi domain xong toàn bộ passkey chết | `rpId` gắn domain vĩnh viễn | Chốt domain TRƯỚC passkey đầu tiên — không có cách chữa |

## Cổng nghiệm thu cứng
1. 3 spike gate xanh, `SPIKE-PASSKEY.md` tồn tại. 2. Ví mới mở bằng WASM hash + constructor args, không hard-code contract ID. 3. Extension signer bị chặn đúng khi thử đổi policy. 4. Gỡ signer laptop → hai vỏ kia vẫn ký được. 5. Đường trả phí chạy thật (Relayer hoặc fee-bump) trên testnet với tx contract.
