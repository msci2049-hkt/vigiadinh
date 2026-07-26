# Threat Model — VíGiaĐình (PHA 10)

> Một trang, khớp CODE THẬT (không phải nguyện vọng). Cập nhật khi thêm tính năng chạm
> custody/khoá/di chúc (luật security §on-chain). Chưng cất theo skill `stellar-security`.
> Cập nhật gần nhất: 2026-07-25 (closeout đợt 2 — đóng B-SEC-1/2/5, vá một phần B-SEC-3/4).

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
| **Guardian thông đồng ≥threshold** | Timelock dài + notify **email** (push CHƯA cấu hình) + owner veto THẮNG threshold trong timelock; policy on-chain | `finalize_recovery` gác timelock; `cancel_recovery` bởi ví thắng cả khi đủ phiếu (test `veto_kills_recovery_and_approve_after_dies`). Đường báo: `be/src/jobs/notification-dispatch.ts`, test `notification-dispatch.integration.test.ts` (mail thật vào Mailhog) |
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
   ▸ **Collusion 2 guardian — DIỆT BẰNG KIẾN TRÚC, không phải bằng luật** (điểm mạnh nhất): custody
   chuyển sang **contract account** (smart account) nên "đủ ngưỡng guardian" KHÔNG bằng "chiếm được
   ví". Recovery chỉ XOAY SIGNER qua `recovery_rotate` + **timelock on-chain** + **cửa sổ veto của
   chủ ví** + **cooldown sau xoay** (chối mọi chữ ký ngay sau finalize, mã #101). Guardian thông đồng
   vẫn phải chờ hết timelock công khai, và chủ ví veto được trong cửa sổ đó — khác hẳn multisig classic
   nơi đủ chữ ký là rút ngay. Chứng minh on-chain: audit P0 (khoá mới ký được, khoá cũ chối, cooldown chặn).
3. **js-xdr 4.0.0 `toXDR`** hỏng — encode vector auth entry tự đóng khung (be+fe đối xứng).

## Gửi tiền (SEND) — kẻ địch + đòn đỡ (bổ sung 2026-07-24)

| Kẻ địch | Đòn đỡ | Cưỡng chế |
|---|---|---|
| Chiếm BE, cố rút tiền | BE build+simulate nhưng KHÔNG ký được của user; ví phí chỉ ký ENVELOPE | Chữ ký `from` qua `__check_auth` passkey; whitelist /sign chặn source-account credentials (ví phí tự authorize) |
| Ký mù (tráo nội dung tx sau khi người dùng đồng ý) | FE **giải mã entry rồi so với thứ người dùng vừa gõ** trước khi ký (audit 2026-07-25 P0-1) | `lib/auth-entry-guard.ts` so `to`+`amount`+contract với **state cục bộ** của màn gửi, KHÔNG với giá trị backend echo; BE `validateSignedTransfer` so tiếp với intent |
| Vượt hạn mức lén | Policy gate → awaiting_guardian, phiếu bound challenge_hash (K5); **và bước nộp cuối kiểm lại entry với intent** | `confirmSend` + `guardianApproveIntent` (P3 re-eval); `validateSignedTransfer` so `to`+`amount`; `assertTransition` dùng trạng thái THẬT của intent |
| Người nhận lạ | Policy v1: recipient chưa từng settled → require_guardian (mặc định an toàn) | `policy-engine` unknown_recipient |
| Double-tap / gửi 2 lần | intent idempotent (unique wallet+client_intent_id); state machine 1 chiều submitting→settled | `createIdempotent` + `assertTransition` |
| Số dư thiếu → tạo tx rác | Kiểm số dư TRƯỚC khi tạo signable tx; thiếu → chặn ở validating, không sang review | `prepareSend` (đọc SAC.balance trước biometric) |

Chứng minh on-chain: e2e testnet gửi 1 XLM từ ví C…, người nhận nhận đủ (`docs/evidence §PHA 6 SEND`).

## Bất biến kỹ thuật đang cưỡng chế bằng test/guard

- K1 origin allow-list (3 vỏ): `origin-verifier` cargo test; production pin domain thật (TODO khi có domain).
- K2 challenge dẫn xuất từ tx: kit `signAuthEntry` + digest OZ; **chứng minh on-chain** ở e2e P0
  (ed25519) VÀ §PASSKEY-ONCHAIN (secp256r1 thật — cùng đường digest, khác verifier).
  ⚠️ **K2 KHÔNG phải phòng tuyến chống ký mù** — audit 2026-07-25 đã tính công cho nó quá tay.
  K2 ràng chữ ký vào *entry đã ký*; nó không nói entry đó có đúng *thứ người dùng thấy* hay
  không. Việc đó là của `lib/auth-entry-guard.ts` (FE) + kiểm entry-vs-intent (BE).
- K5 approval binding: `intents` `challenge_hash` (sửa amount → binding chết, test `approval-flow`).
- Fingerprint khoá mới: **vector chéo Rust↔TS pin cứng** (`signer_fingerprint_cross_language_vector`).
- Audit append-only: TRIGGER Postgres — UPDATE/DELETE (0002) **và TRUNCATE** (0008, statement-level)
  chết thật (test integration). Còn hở: app chạy bằng role sở hữu bảng → `DROP TRIGGER` được (B-SEC-4).
- Indexer là người ghi DUY NHẤT của mirror; sống sót restart giữa batch (checkpoint atomic).

## Closeout đợt 3 (2026-07-26) — chuỗi thông báo

- **🔴 Đường báo cho chủ ví ĐÃ NỐI LIỀN (mắt xích veto).** Trước đợt này:
  `enqueueNotification()` chỉ INSERT một dòng vào bảng `notifications` rồi HẾT — **không
  consumer nào** đọc bảng đó, và `sendEmail` có đúng **một** caller trong toàn repo
  (`auth.ts`, OTP đăng ký). Nghĩa là 4 producer (recovery-watch, presence-ping, indexer,
  heartbeat) đều ghi vào một hàng đợi **không ai đọc**. Chủ ví KHÔNG BAO GIỜ biết có
  recovery đang mở → cửa sổ veto vô nghĩa, vì `finalize_recovery` không cần auth.
  **Đã vá:** `be/src/jobs/notification-dispatch.ts` (cron 60s, claim lease atomic
  `FOR UPDATE SKIP LOCKED`, backoff mũ, tối đa 5 lượt).
  **Bằng chứng `[CHẠY THẬT]`:** `be/src/jobs/notification-dispatch.integration.test.ts` —
  enqueue → tick → **mail nằm trong hộp thư Mailhog thật** (đọc lại qua HTTP API, không
  phải mock); tick lần hai KHÔNG gửi lại (idempotent).
- **Push (`channel='push'`) CHƯA CẤU HÌNH và cố ý fail ỒN ÀO.** Thiếu
  `FIREBASE_SERVICE_ACCOUNT_JSON` → row đánh `failed` + `last_error='PUSH_NOT_CONFIGURED'`
  + log ERROR, KHÔNG im lặng bỏ qua. Cờ đọc-bằng-máy: `/ready` → `watchers.push`.
  **Hệ quả còn nguyên:** kênh ngoài-app hiện CHỈ có email. Với ví thừa kế (ca dùng chính là
  *nhiều năm không mở app*) email là đường DUY NHẤT còn sống — chưa có kênh dự phòng nào.
- **`recovery-watch` skip im lặng — ĐÃ ỒN ÀO.** Thiếu `CONTRACT_ID_RECOVERY` thì cron vẫn
  chạy 10 phút/lần, không kiểm ví nào, không lỗi. Nay log WARN mỗi lần skip + cờ
  `/ready` → `watchers.recoveryWatch = "disabled"`.
  **CHƯA ĐÓNG:** điều kiện đóng thật là deploy contract testnet → set `CONTRACT_ID_RECOVERY`
  → xác nhận `alerted > 0` trong một lần dựng recovery thật. Chưa làm được phiên này.

## Closeout đợt 2 (2026-07-25) — đóng gì, và phát hiện MỚI

- **🔴 MỚI · Backend sập là BẤT ĐỐI XỨNG (kịch bản #3).** Đợt trước ghi "caveat"; sai.
  `finalize_recovery` chạy với **zero auth entry** → sau timelock, kẻ tấn công tự nộp tx lên RPC
  công cộng, KHÔNG cần backend của mình sống. Còn veto (`cancel_recovery`) đòi chữ ký ví, và trong
  sản phẩm đường DUY NHẤT để dựng + nộp tx veto là hai lời gọi backend (`POST /api/recovery/veto`
  → `POST /api/recovery/submit`). Backend sập ⇒ **mất phòng tuyến của người phòng thủ, giữ nguyên
  đường tấn công**. Test khoá kết luận:
  `contracts/recovery-registry/src/test.rs::veto_needs_the_owner_key_while_finalize_needs_nobody`.
  Lỗ nằm ở **client/hạ tầng, KHÔNG ở contract** (contract không đòi khoá nào của backend cho veto)
  → vá bằng đường nộp trực tiếp phía client, không cần đổi contract. **Chưa vá.**
- **Lời mời người bảo hộ LÀ `link-is-auth`** (câu hỏi §3.3, giờ trả dứt). `POST /invites/:token/accept`
  chỉ đòi `requireAuth` — bất kỳ tài khoản app nào — và tra lời mời **thuần theo token**: không khớp
  email, không khớp danh tính người được mời. Ai giữ link mà có tài khoản là nhận được; ai nhận
  trước thắng (`markDeployed` so-và-đặt nguyên tử trên `status='sent'`).
  **Đòn đỡ:** nhận lời mời KHÔNG tự thành người bảo hộ on-chain — chủ ví phải tự ký `add_guardian`,
  cửa build chốt `NOT_OWNER`. Test #8:
  `be/src/modules/recovery/features/onchain-actions/service.test.ts::"kẻ lạ nhận link của người khác
  KHÔNG tự lên chain làm người bảo hộ"`.
  **Còn yếu (chưa vá):** bước chủ ví duyệt là duyệt **một cái nhãn do chính họ đặt** ("Mẹ").
  `accepted_by_user_id` CÓ ghi nhưng chưa hiện tên/email người nhận thật lên màn duyệt → link rò
  vẫn dẫn tới việc chủ ví ký cho người lạ mà không biết. Việc cần làm: hiện danh tính người nhận.
- **Ví phí (B-SEC-3) — ĐÓNG.** Ba hàng rào đủ: `is_registered` đọc **từ chain** (không phải cột DB,
  nên kẻ ghi DB tuỳ ý không bật được công tắc này) · rate-limit failOpen:false · trần phí per-tx.
  Đợt 1 chỉ có hàm trần phí và chỉ cắm ttl-keeper; hai cửa người dùng gọi truyền `undefined`.
  `be/src/services/stellar/fee-policy.ts`.
- **Nhật ký audit (B-SEC-4) — ĐÓNG ở tầng quyền.** Migration 0009: role `app_runtime` chỉ
  SELECT/INSERT trên `audit_log`, REVOKE UPDATE/DELETE/TRUNCATE khỏi cả role lẫn PUBLIC, không sở
  hữu schema nên không có `DROP TRIGGER`. Test chạy **bằng role runtime** và tự kiểm không-owner +
  không-superuser trước khi assert. **Chưa ACTIVE:** `DATABASE_URL` còn trỏ owner (việc deploy).
- **Instance storage của ví — KHÔNG cần vá TTL** (câu hỏi §3.1, trả bằng test). Bốn khoá instance
  (`RecoveryRegistry`, `OwnerRuleId`, `LastRotation`, `PendingRegistry`) sống qua ~6 tháng bỏ không:
  Protocol 23 auto-restore khi có ai đọc tới. Giá là rent trên tx đánh thức, không phải mất dữ liệu.
  Bằng chứng **hermetic** (test env mô phỏng), CHƯA đo on-chain.
  `recovery-registry/src/test.rs::wallet_instance_storage_survives_months_of_disuse`.
- **JWT ví thu hồi được (§4) — ĐÓNG phần quyết định.** `jwt_version` + `ver` trong claims +
  `verifyWalletJwtCurrent` (bắt buộc truyền lookup, facade chỉ export bản này). **Đính chính premise:**
  JWT ví hiện được PHÁT nhưng **không route/middleware nào tiêu thụ** → rủi ro "đọc được 24h" là
  TIỀM ẨN, chưa sống. Vì thế test "JWT cũ → 401 trên /session" chưa viết được: chưa có endpoint đó.
- **Phát hiện nhỏ:** trần cooldown kiểm **fail-late** — `propose_recovery_registry` nhận cooldown
  vượt trần, chỉ `apply` (7 ngày sau) mới chối. Bom không hạ cánh được (`store` fail-closed) nhưng
  người dùng tự kẹt đường đổi registry tới khi `cancel`.
- **Phát hiện nhỏ:** `lefthook.yml` ở root là **file ví dụ, comment sạch 100%** — nên "pre-commit
  quét secret / pre-push build thật" mà `.claude/rules/` khẳng định **KHÔNG tồn tại**. gitleaks chỉ
  chạy trong CI + tay.

## Còn hở — khai thẳng (chưa xong, không phải đã an toàn)

- **Audit toàn diện 2026-07-25** (`docs/security/AUDIT-2026-07-25.md` §7 closeout): 7 P0 đã vá.
  Closeout đợt 2 đóng thêm: **B-SEC-1** `recovery_rotate` (xoay neo nguyên tử), **B-SEC-2** TTL
  `SignerData`, **B-SEC-5** ký mù approve/veto. **Đính chính overclaim cũ:** TTL keeper bỏ sót
  `SignerData` KHÔNG phải "ví hỏng vĩnh viễn" — cả ba key OZ là **persistent** (archive **cứu được**
  bằng `RestoreFootprint`, Protocol 23+), mất ví TẠM THỜI → mức 🟠. Còn hở một phần: B-SEC-3 (lọc
  `is_registered`), B-SEC-4 (tách role DB). Contract đã đổi shape LẦN NỮA → **phải deploy lại testnet
  + chạy lại e2e** trước khi tin bằng chứng on-chain cũ (B-SEC-7).
- **Ký mù ở `guardian/approve` và `block/confirm`** — ĐÃ CHỐT bằng `assertApproveRecoveryEntry`/
  `assertCancelRecoveryEntry` (so state cục bộ, entry `transfer` đội lốt bị chặn TRƯỚC passkey).
- **SEP-45 token** bind ví+device, chống replay bằng nonce, và **ĐÃ có đường thu hồi** khi khôi phục
  (`jwt_version`, closeout §4 — thay cho dòng "chưa thu hồi" cũ). Còn hở phần khác: **check footprint
  theo spec SEP-0045 chưa cài** — spec đòi client simulate rồi verify `read_write` CHỈ chứa
  `contract_data` với key `ledger_key_nonce` của Client/Server/(Client Domain) Account, và từ chối
  entry `delegated`. Hiện dựa vào `assertApproveRecoveryEntry`/`assertCancelRecoveryEntry` (chặn theo
  hình dạng đã biết) + custody on-chain, KHÔNG phải cơ chế footprint của spec → biến thể ký mù chưa
  bị chặn *theo cơ chế*. Mức 🟠, chưa vá.
- **origin-verifier production**: deploy script fail-closed chặn localhost/non-https/wildcard; hot-path
  đổi `.expect()`→`panic_with_error!`. Instance testnet đang chạy VẪN là DEV — production chạy
  `deploy-origin-verifier.sh` với domain thật (HUMAN-TODO, chờ domain).
- **Đường ký WebAuthn qua kit vào contract — ĐÃ CHỨNG MINH ON-CHAIN** (B-23-2 ĐÓNG 2026-07-24):
  passkey secp256r1 (virtual authenticator, ceremony `navigator.credentials` thật) ký SAC transfer
  qua `__check_auth → origin-verifier` trong MỘT tx settled testnet (`docs/evidence §PASSKEY-ONCHAIN`,
  tx `e83adb27…`; `get_context_rule(0)` = signer secp256r1, không phải ed25519). Còn lại: ký bằng
  sinh trắc học của người dùng THẬT trên thiết bị thật (Chrome 122+/Safari iOS) — virtual authenticator
  đã phủ đường crypto, phần còn lại là UX phần cứng.
- **AI người gác đêm** chưa nối — risk banner/explainer là PHA sau; kill-switch là thiết kế sẵn.
- **Mainnet** chưa lên (PARK 9.2): TTL extend cron, Audit Bank, pin crate OZ — checklist go-live chưa chạy.
- **CI thật** VẪN chưa xác minh được (B-CI-1 còn MỞ). Closeout đợt 2 đã thử hết đường từ máy build:
  không có `gh`, không có `~/.config/gh`, không có `GH_TOKEN`/`GITHUB_TOKEN` trong env
  (`be/.mcp.json` chỉ chứa placeholder `${GITHUB_PERSONAL_ACCESS_TOKEN}`); API không token trả
  **404** vì repo private; SSH key `github-msci` xác thực được (`git ls-remote` chạy) nhưng GitHub
  **không phục vụ Actions API qua SSH**. → **KHÔNG kết luận màu CI.** Cần PAT fine-grained
  (Actions:read + Contents:read) mới đóng được mục này.
- **Mutants:** 226 mutant toàn workspace — 181 caught, 13 missed (xem `docs/security/mutants.txt`).
  `__check_auth`/cooldown: **0 mutant sống** (điều kiện đóng B-SEC-9). Còn sống: 12 trong
  `verifier-webauthn` (crate SPIKE, không phải verifier tích hợp) + 1 mutant **tương đương** trong
  `smart-account` (`owner_rule_id -> 0`, vì rule chủ ví đúng là id 0 — không giết được trung thực).
- **Fuzz/proptest** chưa có: máy build không có nightly nên `cargo-fuzz` không dựng được; đường
  `proptest` trên stable CHƯA làm. Ba target còn nợ: `__check_auth`, `finalize_recovery`,
  `recovery_rotate`.
