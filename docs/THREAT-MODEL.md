# Threat Model — VíGiaĐình (PHA 10)

> Một trang, khớp CODE THẬT (không phải nguyện vọng). Cập nhật khi thêm tính năng chạm
> custody/khoá/di chúc (luật security §on-chain). Chưng cất theo skill `stellar-security`.
> Cập nhật gần nhất: 2026-07-24, sau AUDIT P0 (khôi phục xoay khoá trong smart account).

## Câu hỏi thử vàng

> **"Chiếm được backend thì làm được gì?"** → Đáp án bắt buộc: KHÔNG mất tiền, KHÔNG đọc được
> di chúc, KHÔNG khôi phục hộ ai. Bất kỳ đáp án khác = sửa THIẾT KẾ, không vá.

Trạng thái dự án: custody = smart account (contract account) mỗi hộ; passkey secp256r1 qua
origin-verifier; recovery = registry v2 (guardian vote + timelock + veto) **xoay signer BÊN
TRONG smart account** (audit P0); AI chưa nối; két di chúc ĐÃ HỦY (bất biến 3 ngủ tới khi quay lại).

## 4 bất biến — ánh xạ tới code

| # | Bất biến | Cưỡng chế ở đâu (thật) |
|---|---|---|
| 1 | Custody trên chuỗi — BE sập không mất tiền | `contracts/smart-account` giữ signer; BE chỉ build+simulate, ví phí ký ENVELOPE (`services/stellar`) |
| 2 | BE/AI không tạo được chữ ký thay chủ ví | grep `Keypair.fromSecret\|.sign(` ngoài test = ví phí + SEP-45 server key; chữ ký user sinh ở passkey qua `__check_auth` |
| 3 | Server không đọc di chúc | Két di chúc đã hủy — bất biến ngủ; hồi sinh cùng tính năng nếu quay lại |
| 4 | Mọi đổi quyền có timelock + veto + audit | `recovery-registry` timelock on-chain + `cancel_recovery` (ví ký) + indexer ghi `audit_log` (append-only trigger) |

## 5 kẻ địch — mỗi dòng một đòn đỡ (khớp code)

| Kẻ địch | Đòn đỡ chính | Cưỡng chế |
|---|---|---|
| **Kẻ lừa guardian** (giả chủ ví, xin duyệt) | Xác minh NGOÀI BĂNG (đọc fingerprint khoá mới qua điện thoại) + timelock + owner veto mọi kênh | FE `guardian/initiate` + `guardian/approve` hiện fingerprint từ mirror-chain; `sign-recovery-entries` chống-ký-mù; `entry-fingerprint` so khoá trong entry vs mirror TRƯỚC khi ký |
| **Guardian thông đồng ≥threshold** | Timelock dài + notify đa kênh + owner veto THẮNG threshold trong timelock; policy on-chain | `finalize_recovery` gác timelock; `cancel_recovery` bởi ví thắng cả khi đủ phiếu (test `veto_kills_recovery_and_approve_after_dies`) |
| **Chiếm backend** | Bất biến 1+2: không key, custody on-chain — mất availability, không mất tiền/quyền | Registry chỉ là *delegated invoker* cho ĐÚNG cửa `recovery_rotate`; chiếm BE cũng chỉ build được tx, không ký được của user; **cooldown** chặn xoay-rồi-rút-ngay |
| **Chiếm AI** | AI không secret, không route ghi, output validate, kill-switch | Chưa nối AI (PHA sau); kill-switch `AI_ENABLED=false` là ràng buộc thiết kế |
| **Mất máy hàng loạt** (nhà cháy) | Passkey sync platform + guardian ngoài hộ + heartbeat ladder + luồng máy-mới public | `recovery/*` PUBLIC (không cần session); `recovery.device_requested` notify guardian; heartbeat tier 1/2/3 (PHA 4) |

## Lỗ hổng ĐÃ TÌM + ĐÃ VÁ (không giấu)

1. **P0 · Khôi phục không xoay khoá thật** (2026-07-24): registry v1 (`CCPGVSLR…`) chỉ đổi `owner`
   trong storage của nó — smart account không biết, thiết bị mới không ký được gì. **Vá:** registry
   v2 gọi `recovery_rotate` (invoker auth) xoay signer BÊN TRONG account; verify từ chính account;
   cooldown sau xoay. E2e testnet 4 pass, 12 tx (`docs/evidence/TESTNET.md §AUDIT P0`).
2. **Phiếu ma / DoS request treo / collusion** (C7/C8/C9): registry v2 — request có `started_at` +
   status, veto đóng request, đổi guardian bị đóng băng khi recovery mở, **chống-lockout on-chain**
   (gỡ guardian dưới threshold bị chặn — test `remove_guardian_lockout_blocked`).
3. **js-xdr 4.0.0 `toXDR`** hỏng — encode vector auth entry tự đóng khung (be+fe đối xứng).

## Gửi tiền (SEND) — kẻ địch + đòn đỡ (bổ sung 2026-07-24)

| Kẻ địch | Đòn đỡ | Cưỡng chế |
|---|---|---|
| Chiếm BE, cố rút tiền | BE build+simulate nhưng KHÔNG ký được của user; ví phí chỉ ký ENVELOPE | Chữ ký `from` qua `__check_auth` passkey; whitelist /sign chặn source-account credentials (ví phí tự authorize) |
| Ký mù (tráo nội dung tx sau khi người dùng đồng ý) | Challenge dẫn xuất từ tx đã simulate (K2) — kit derive digest từ entry; sửa amount/recipient = entry khác = chữ ký cũ chết | `send-flow` build tx → FE ký entry đó; `validateSignedTransfer` khớp SAC+transfer+from |
| Vượt hạn mức lén | Policy gate → awaiting_guardian, phiếu bound challenge_hash (K5); guardian duyệt off-chain rồi owner MỚI ký | `confirmSend` + `guardianApproveIntent` (P3 re-eval); amount đổi sau duyệt → K5 binding chết |
| Người nhận lạ | Policy v1: recipient chưa từng settled → require_guardian (mặc định an toàn) | `policy-engine` unknown_recipient |
| Double-tap / gửi 2 lần | intent idempotent (unique wallet+client_intent_id); state machine 1 chiều submitting→settled | `createIdempotent` + `assertTransition` |
| Số dư thiếu → tạo tx rác | Kiểm số dư TRƯỚC khi tạo signable tx; thiếu → chặn ở validating, không sang review | `prepareSend` (đọc SAC.balance trước biometric) |

Chứng minh on-chain: e2e testnet gửi 1 XLM từ ví C…, người nhận nhận đủ (`docs/evidence §PHA 6 SEND`).

## Bất biến kỹ thuật đang cưỡng chế bằng test/guard

- K1 origin allow-list (3 vỏ): `origin-verifier` cargo test; production pin domain thật (TODO khi có domain).
- K2 challenge dẫn xuất từ tx: kit `signAuthEntry` + digest OZ; **chứng minh on-chain** ở e2e P0.
- K5 approval binding: `intents` `challenge_hash` (sửa amount → binding chết, test `approval-flow`).
- Fingerprint khoá mới: **vector chéo Rust↔TS pin cứng** (`signer_fingerprint_cross_language_vector`).
- Audit append-only: TRIGGER Postgres (migration 0002), UPDATE/DELETE chết thật (test integration).
- Indexer là người ghi DUY NHẤT của mirror; sống sót restart giữa batch (checkpoint atomic).

## Còn hở — khai thẳng (chưa xong, không phải đã an toàn)

- **origin-verifier production** còn là bản DEV localhost — chưa pin 3 origin domain thật (chờ domain).
- **Đường ký WebAuthn qua kit vào contract** verify được ở e2e BE bằng ed25519; nhánh passkey thật
  cần Chrome 122+ / máy có authenticator (B-23-2, thu hẹp nhiều sau P0).
- **AI người gác đêm** chưa nối — risk banner/explainer là PHA sau; kill-switch là thiết kế sẵn.
- **Mainnet** chưa lên (PARK 9.2): TTL extend cron, Audit Bank, pin crate OZ — checklist go-live chưa chạy.
- **CI thật** chưa đọc được từ máy build (B-CI-1) — gate tái hiện local, chờ người mở tab Actions.
