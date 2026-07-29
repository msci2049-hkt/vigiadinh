# AUDIT TÍNH NĂNG — đối chiếu handoff v0.2 với code thật (2026-07-29)

> Phiên audit read-only trên bản `ae9cdd8`. Nguồn đặc tả: `tai-lieu/tai-lieu-du-an/vigiadinh-dev-handoff.html`
> (v0.2, 23/07/2026). Mọi kết luận có `file:dòng` hoặc output lệnh; không thấy thì ghi **KHÔNG THẤY**.
> Chuyện verify contract có file riêng: `docs/VERIFY-CONTRACT.md`.

---

## 0 · TÓM TẮT MỘT TRANG

**Ba câu quan trọng nhất:**

1. **Tiền "kẹt" không kẹt vĩnh viễn nhưng kẹt đủ chết demo**: lệnh 10 XLM nằm ở `awaiting_guardian`
   với TTL 24h (sweeper 5'/lần sẽ cho hết hạn) — nhưng guardian **không được báo, không có endpoint
   liệt kê phiếu chờ, không có màn hình duyệt**, owner **không huỷ chủ động được**. Đứt ở 3 tầng (A5, A6).
2. **Contract KHÔNG cưỡng chế bất kỳ luật chi tiêu nào** — nhưng ví đang tồn tại `CD5QX3…` đã có sẵn
   khung policy của OZ (`add_policy`/`add_context_rule` live on-chain), và crate `stellar-accounts 0.7.2`
   **có sẵn policy `spending_limit`** → thêm hạn mức on-chain KHÔNG cần tạo ví mới, không mất passkey/guardian (§2.3).
3. **Chưa có tích xanh explorer**: cả 5 contract `"validation": "unverified"` trên StellarExpert;
   build tái lập thì đã đạt 100%. Lộ trình ~0.5–1.5 ngày (xem `docs/VERIFY-CONTRACT.md`).

**Bảng tổng ✅/🟡/⛔ (chi tiết 5 ô từng mục ở §2):**

| # | Tính năng | TT | # | Tính năng | TT |
|---|---|---|---|---|---|
| A1 | Ngưỡng mỗi lệnh | ✅ | B5 | Care hết hạn ≤30d | 🟡 |
| A2 | Hạn mức 24h | 🟡 | B6 | Owner revoke tức thì | ⛔ |
| A3 | Người nhận xác minh vs lạ | 🟡 | B7 | Nhật ký chi care | ⛔ |
| A4 | State machine intent | ✅ | C1 | Plan + heir theo % | 🟡 |
| A5 | 🔴 Báo guardian chờ duyệt | ⛔ | C2 | Đếm im lặng | ✅ |
| A6 | 🔴 Huỷ lệnh chờ / TTL | 🟡 | C3 | Check-in reset counter | ✅ |
| A7 | Policy versioned + owner ký | 🟡 | C4 | Guardian quorum sau im lặng | ⛔ |
| A8 | Re-evaluate sau duyệt | 🟡 | C5 | Timelock cuối + veto | 🟡 |
| A9 | Idempotency intent | ✅ | C6 | Thực thi phân phối % | ⛔ |
| B1 | CareGrant entity | 🟡 | C7 | Plan versioned | 🟡 |
| B2 | 2/3 guardian mở care | ⛔ | D1 | Lời nhắn mã hoá | ⛔ (đã huỷ) |
| B3 | Care hạn mức ngày/tổng | 🟡 | D2 | Sổ đen gia đình | 🟡 |
| B4 | Care allowlist + purpose | 🟡 | D3 | Lọc token rác | ⛔ |
| | | | D4 | Sổ giao dịch / xuất thuế | 🟡 |
| | | | D5 | Audit log append-only | ✅ |

Đếm: **✅ 6 · 🟡 12 · ⛔ 8** (trên 26 mục).

---

## 1 · VERIFY CONTRACT (tóm tắt — chi tiết ở docs/VERIFY-CONTRACT.md)

- **V-Q1** — 4 contract hạ tầng + wasm smart-account: hash on-chain **khớp 100%** artifact
  `contracts/target/wasm32v1-none/release/*.wasm` (build 2026-07-28 00:56 từ cây ae9cdd8).
  Bảng hash đầy đủ: VERIFY-CONTRACT.md §2. (Không chạy lại `stellar contract build` trong phiên —
  /mnt/d chậm; dùng artifact có sẵn đã khớp on-chain làm bằng chứng.)
- **V-Q2** — contractmeta chỉ có `rsver 1.97.1 · rssdkver 26.1.1 · cliver 27.0.0`.
  **KHÔNG có source_repo / commit hash** nhúng trong wasm.
- **V-Q3** — StellarExpert hỗ trợ validation cho cả testnet (API trả trường `validation`);
  cơ chế = GitHub Actions reusable workflow `stellar-expert/soroban-build-workflow`, trigger tag `v*`,
  build + attest hash. Dự án **chưa có**: file `.github/workflows/release.yml` + tag release.
- **V-Q4** — origin `msci2026vn/family-wallet`: **PRIVATE** (curl không token → 404).
  Mirror `msci2049-hkt/vigiadinh`: **PUBLIC** → điều kiện source công khai đã thoả.
- **V-Q5** — **CHƯA có tích xanh**: cả 5 contract (kể cả ví thật CD5QX3…) đều
  `"validation":{"status":"unverified"}` trên `api.stellar.expert/explorer/testnet`.
  Các bước + ước lượng ~0.5–1.5 ngày: VERIFY-CONTRACT.md §6–§7.

---

## 2 · AUDIT TÍNH NĂNG — từng mục 5 ô

### A · Policy chi tiêu (P0)

**A1 · Ngưỡng mỗi lệnh — ✅**
- Bằng chứng: `be/src/modules/intents/features/send-flow/service.ts:24` `SEND_PER_TX_LIMIT_STROOPS = 20_000_000n * 10_000_000n` (= **20 triệu XLM**); luật ở `be/src/modules/intents/domain/policy-engine.ts:48-50` (`over_tx_limit` → `require_guardian`).
- Cưỡng chế: **BE** (hằng số hard-code; không env, không DB, user không đổi được).
- Nên ở: contract (policy `spending_limit` per-tx) — kẻ chiếm BE sửa hằng số là vượt ngưỡng.
- Khoảng cách: ngưỡng 20M XLM lớn phi thực tế → nhánh này gần như không bao giờ chạy; cổng thật đang là `unknown_recipient` (A3). Thiếu: ngưỡng cấu hình được per-ví + cưỡng chế on-chain.

**A2 · Hạn mức 24 giờ — 🟡 (code có, bị tắt)**
- Bằng chứng: engine có luật `policy-engine.ts:51-53` (`over_daily_limit`); query tổng chi thật `intents.repository.ts:139-151` (`dailySpent`); **nhưng caller truyền chết** `service.ts:196` `dailyLimit: null` → không bao giờ kích hoạt. Cửa sổ là ngày lịch UTC (`service.ts:184-185`), không phải rolling 24h.
- Cưỡng chế: **chưa ai** (BE có hạ tầng, disabled).
- Nên ở: contract (OZ `spending_limit` có rolling window theo ledger — §2.3) — hạn mức ngày là hàng rào chống rút cạn, BE bị chiếm không được vượt.
- Khoảng cách: nối giá trị limit thật vào `dailyLimit` (BE, ~0.5 ngày) hoặc deploy policy on-chain (~1-2 ngày).

**A3 · Người nhận đã xác minh vs lạ — 🟡**
- Bằng chứng: `policy-engine.ts:45-47` (`unknown_recipient`); "đã quen" = **suy từ lịch sử intent settled** `intents.repository.ts:128-136` (`knownRecipients`). **KHÔNG THẤY** bảng danh bạ/contacts/verified-recipient (grep `address_book|contacts|whitelist|known_recipient` → 0 hit ngoài care schema).
- Cưỡng chế: **BE**.
- Nên ở: BE (danh bạ là tiện nghi/UX; on-chain chỉ cần allowlist trong care mode).
- Khoảng cách: bảng contacts + luồng "xác minh người nhận" (mời/QR); hiện lần gửi đầu cho bất kỳ ai luôn đòi guardian.

**A4 · State machine intent — ✅**
- Bằng chứng: 13 trạng thái nguyên văn `shared/intent.ts:9-23`: `draft, validating, review, policy_gate, awaiting_guardian, approved, awaiting_signature, submitting, settled, rejected, expired, cancelled, submit_failed` — khớp handoff §03 (thêm `submit_failed` tách riêng). CHECK constraint DB khớp (`intents.schema.ts:64`, xác nhận trên DB thật §3). Bảng transition `domain/state-machine.ts:48-84`, cưỡng chế `assertTransition` :107-117; 9 call-site thật trong `send-flow/service.ts` + 3 trong `approval-flow.ts`.
- Cưỡng chế: **BE** (đúng chỗ — state machine là orchestration).
- Khoảng cách: action **không có call-site** (code chết): `request_clarify, cancel, validate_fail, guardian_reject, challenge_expire, retry_submit`.

**A5 · 🔴 Thông báo guardian khi có lệnh chờ — ⛔ (đứt 3 tầng)**
- Bằng chứng chỗ đứt chính xác — **loại (a)+(c) đồng thời**:
  1. Nhánh `require_guardian` (`send-flow/service.ts:211-241`): update status + `createGuardianApprovals` + audit `intent.awaiting_guardian` rồi **return — không import, không gọi notifications**.
  2. Hạ tầng notify TỒN TẠI đầy đủ: template `approval.requested` en+vi (`notifications/domain/templates.ts:85-94`), dispatcher 3 kênh push/email/sse (`be/src/jobs/notification-dispatch.ts:152-183`, worker mounted `workers/index.ts:317`), facade `enqueueNotification` — 5 call-site (presence, recovery-watch, indexer, heartbeat, recovery) — **không có intents**.
  3. Event router có entry `approval.requested` (`indexer/domain/event-router.ts:28`) nhưng chỉ được nuôi bởi event on-chain — approval là off-chain thuần, không ai phát. Và đường notify của indexer chỉ gửi **owner** (`indexer.service.ts:218-224` `userId: wallet.ownerUserId`), không fan-out guardian.
  4. BE **không có endpoint liệt kê** phiếu chờ cho guardian — đường đọc duy nhất `approvalForGuardianUser(intentId, userId)` (`intents.repository.ts:186-197`) đòi biết trước intentId.
  5. FE guardian **không có màn hình**: grep `guardian-approve` trong `fe/apps/web/src` → 0 hit; endpoint `POST /api/intents/send/guardian-approve` (`send-flow/handler.ts:148-162`) không có client nào gọi; `/protecting` chỉ nạp inbox **recovery** (`features/family/api/guardian-inbox.ts:21`).
  - DB thật xác nhận (§3): audit có `intent.awaiting_guardian`, bảng `notifications` **0 dòng** sau thời điểm tạo intent.
- Cưỡng chế: **chưa ai**.
- Nên ở: BE (notification là orchestration thuần).
- Khoảng cách để chạy được: (1) gọi `enqueueNotification(template approval.requested)` cho từng guardian trong nhánh require_guardian; (2) endpoint `GET` list phiếu pending theo guardian user; (3) màn hình duyệt trong `/protecting` gọi `guardian-approve`. Ước lượng 1–2 ngày.

**A6 · 🔴 Huỷ lệnh chờ + TTL — 🟡 (TTL có; cancel không)**
- Bằng chứng: transition `cancel` có đủ 5 dòng trong bảng (`state-machine.ts:51,58,64,68,76`) nhưng **0 call-site** — không endpoint, không service, không FE (grep `cancelIntent|/cancel|revoke` → chỉ hit veto recovery). TTL: `expiresAt` đặt lúc tạo draft 24h (`intents.repository.ts:71`, `domain/ttl.ts:3`); sweeper cron 5'/lần (`jobs/intent-sweeper.ts:29`) expire intent + phiếu (`intents.repository.ts:232-261`). **Bất nhất**: intent TTL 24h nhưng phiếu guardian TTL 48h (`service.ts:26`) — intent chết trước phiếu 24h; `approvalTtlSeconds(riskScore)` (`ttl.ts:9-14`) không có call-site. Sweep **không thông báo ai**.
- Cưỡng chế: **BE** (TTL); cancel: **chưa ai**.
- Nên ở: BE (huỷ khi tiền chưa đi là off-chain thuần — chưa có chữ ký nào tồn tại).
- Khoảng cách: endpoint `POST /api/intents/:id/cancel` (transition đã có sẵn trong bảng, ~0.5 ngày) + đồng bộ TTL intent/phiếu + notify khi expire.

**A7 · Policy versioned + owner ký khi đổi — 🟡**
- Bằng chứng: versioned **có, làm tử tế** — registry bất biến `POLICY_ENGINES {1: evaluateV1}` + `CURRENT_POLICY_VERSION` (`policy-engine.ts:63-68`), fail-closed version lạ :75, ghi `policy_version` vào DB + tham gia challenge binding (`hashing.ts:54-63`). Owner ký khi đổi policy: **KHÔNG THẤY** (grep `signPolicy|policy_sig|policySignature` → 0 hit; không bảng `wallet_policies`, không endpoint sửa policy).
- Cưỡng chế: **BE** (version); đổi policy = deploy code mới.
- Nên ở: contract hoặc tối thiểu BE + chữ ký passkey — kẻ chiếm account nâng ngưỡng rồi rút là kịch bản handoff nêu đích danh.
- Khoảng cách: chưa có policy per-ví nào để "đổi" — làm cùng lúc với A1/A2 cấu hình được.

**A8 · Re-evaluate sau duyệt, trước ký — 🟡 (hình thức có, nội dung vô hiệu)**
- Bằng chứng: có gọi thật — `approval-flow.ts:52-67` re-run policy, state machine chặn đường tắt `approved → submitting` (`state-machine.ts:71-73`). **Nhưng** context truyền vào `service.ts:345-353`: `knownRecipients=[chính người nhận]`, `blacklist=[]`, `perTxLimit=null`, `dailyLimit=null` → **luôn ra allow** (comment :338-342 tự nhận). Đường ký cuối `signAndSubmit` (`service.ts:375-449`) không chạy policy — chỉ `validateSignedTransfer` + sponsorship + transition.
- Cưỡng chế: **BE** (khung có, điều kiện rỗng).
- Nên ở: BE (re-eval là orchestration; điều kiện on-chain đã có lớp 4 riêng).
- Khoảng cách: truyền context thật (trừ đúng reason mà guardian đã clear) — ~0.5 ngày.

**A9 · Idempotency key — ✅**
- Bằng chứng: `client_intent_id` + unique `(wallet_id, client_intent_id)` (`intents.schema.ts:71-74`), bắt 23505 trả bản cũ (`intents.repository.ts:73-91`), handler trả `deduplicated` 200/201 (`create-intent/handler.ts:41-43`).
- Cưỡng chế: **BE tầng DB** (đúng chỗ).
- Khoảng cách: FE sinh key MỚI mỗi lần bấm (`wallet/send.tsx:140-148` `crypto.randomUUID()` trong `mutationFn`) → chống retry mạng nhưng **không chống double-tap**; validate lệch giữa 2 DTO (`create-intent/dto.ts:7` uuid vs `send-flow/dto.ts:10` string 1-64).

### B · Care mode — module 1 file schema, không mount, không route, không FE

(Tự khai trong repo: `care-grants.schema.ts:5` *"Module care mới chỉ có tầng schema; routes dựng PHA sau"*; `BUILD-LOG.md:240` "Treo có chủ đích: … care grant/revoke"; `docs/ROUTES.md:78` "FE sau v1 — chưa có khung". `app.ts:192-217` mount 11 module — không có care.)

| # | Trạng thái | Bằng chứng | Cưỡng chế | Nên ở | Khoảng cách |
|---|---|---|---|---|---|
| B1 CareGrant | 🟡 | Bảng `care_grants` có thật (schema + DB VPS §3); module = đúng 1 file `care-grants.schema.ts` | BE (schema) | — | service + routes + FE toàn bộ |
| B2 2/3 guardian mở | ⛔ | KHÔNG THẤY (grep `care.*approval|quorum` → 0; M/N duy nhất là recovery contract `lib.rs:71,352`) | chưa ai | **contract** — mở quyền chi hộ là thay đổi quyền, BE bị chiếm không được tự mở | toàn bộ luồng |
| B3 hạn mức ngày/tổng | 🟡 | Cột `daily_limit`/`total_limit` + CHECK cấu hình (`care-grants.schema.ts:24-25,34-38`); **0 code đọc lúc chi** | DB CHECK (chỉ config) | **contract** (context rule + spending_limit policy — khung OZ có sẵn, §2.3) | đường chi qua care chưa tồn tại |
| B4 allowlist + purpose | 🟡 | `recipient_allowlist` jsonb có cột (:26); `purpose` KHÔNG THẤY (grep → chỉ PWA icon) | cột chết | contract (allowlist) + BE (purpose là metadata) | như trên |
| B5 hết hạn ≤30d | 🟡 | `expires_at` **nullable**, không CHECK trần 30 ngày, không cron care (ls `be/src/jobs/` → 7 job, 0 care) | chưa ai | contract (`valid_until` của context rule làm đúng việc này) | enforcement toàn bộ |
| B6 revoke tức thì | ⛔ | Chỉ cột `revoked_at` + template `care.revoked` (`templates.ts:112-118`) + event-router entry (:33); không endpoint, không link tới intents đang chờ | chưa ai | **contract** (`remove_context_rule` — owner ký là rule chết ngay) | toàn bộ |
| B7 nhật ký chi care | ⛔ | audit_log chung chưa có kind `care.*` nào được insert | chưa ai | BE (audit là off-chain) | toàn bộ |

**Ghi chú kiến trúc:** đường on-chain cho care mode đã có sẵn khuôn trong ví: care grant = `add_context_rule` (type riêng, `valid_until` = hết hạn) + signer guardian + policies (spending_limit + allowlist), revoke = `remove_context_rule`. Xem §2.3.

### C · Thừa kế — nhánh heartbeat chạy thật; nhánh quorum→timelock→phân phối KHÔNG tồn tại

| # | Trạng thái | Bằng chứng | Cưỡng chế | Nên ở | Khoảng cách |
|---|---|---|---|---|---|
| C1 Plan + % | 🟡 | `inheritance_plans` + `heirs.bps` (0–10000 CHECK per-row, `heirs.schema.ts:20-26`); API đọc + FE render % (`inheritance/index.tsx:20-25`). **Tổng =10000 KHÔNG enforce** — `sumBps` không caller, `HEIR_BPS_SUM_INVALID` không được throw; **không có đường ghi** (không feature set-heirs; insert duy nhất là test) | BE DB per-row | BE (ghi) + contract (thực thi) | luồng tạo/sửa plan của user |
| C2 đếm im lặng | ✅ | BE cron `30 * * * *` (`jobs/heartbeat-watch.ts:25`) + redlock; đếm từ `heartbeats.at` — **chỉ cập nhật khi owner bấm nút**, không từ tx/login; fallback `plan.createdAt` (`heartbeat.repository.ts:44`); mặc định **30 ngày** (`inheritance-plans.schema.ts:31` default 2_592_000, sàn 1 ngày) — handoff ví dụ 6 tháng | **BE 100%** | contract (đồng hồ ledger mới là thứ BE-chết-vẫn-đúng) — BE làm reminder | contract inheritance chưa có |
| C3 check-in reset | ✅ | `POST /api/inheritance/heartbeat` (`heartbeat/handler.ts:12-23`, 403 NOT_OWNER) → `escalationTier=0` (`heartbeat.repository.ts:112-115`); thang nhắc 3 tier owner→guardians (`heartbeat-ladder.ts:24-36`); FE route + audit `heartbeat.received`. ⚠️ reset không lọc version/status — reset mọi plan của ví | BE + FE | BE ✓ (đúng chỗ) | — |
| C4 quorum sau im lặng | ⛔ | Tối đa = push `inheritance.suggest_claim` (`heartbeat-ladder.ts:33`); không bảng phiếu claim, không endpoint, không đếm ngưỡng. Tự khai: "mở claim là hành động ON-CHAIN CỦA GUARDIAN, server không bao giờ tự làm" (`heartbeat-ladder.ts:6-7`); event `inheritance_opened/claimed` khai sẵn ở router (:66-75) — contract phát chúng **chưa tồn tại** | chưa ai | **contract** | contract inheritance toàn bộ |
| C5 timelock + veto | 🟡 | `final_timelock_secs` default **7 ngày** (`inheritance-plans.schema.ts:33`, sàn 1h) — chỉ đọc ra hiển thị (`claim.tsx:2-4` "màn này chỉ trình bày"). Veto thừa kế KHÔNG THẤY — veto chỉ có cho recovery (`recovery-registry/src/lib.rs:363`) | chưa ai | **contract** | như C4 |
| C6 thực thi phân phối % | ⛔ | **0 dòng code** (grep `distribut|payout|execute_claim|beneficiary.*transfer` → 0 hit nghiệp vụ). Ai chuyển tiền = KHÔNG AI: BE không ký hộ (`BUILD-LOG.md:237` — 0 ký hộ user), registry chỉ được `recovery_rotate` (`smart-account/src/lib.rs:242` "không rút tiền"), guardian không có đường nào. Đường chuyển duy nhất = send-flow thủ công SAC `transfer` 1-người-nhận (`domain/transfer.ts:23`) | chưa ai | **contract** (hoặc trung thực: "thừa kế = social recovery trao quyền ví cho heir" — đường này ĐÃ chạy, xem docs/INHERITANCE.md) | quyết định thiết kế + contract |
| C7 plan versioned | 🟡 | Schema chuẩn (unique `(wallet_id,version)`, CHECK ≥1) + logic đọc chọn active/mới nhất (`inheritance.repository.ts:23-26`); **không đường ghi** — insert duy nhất trong test; status draft/active/revoked không có transition code | BE schema | BE | feature create/supersede plan |

**Lưu ý C:** `docs/INHERITANCE.md` KHÔNG mô tả chia % — nó là tài liệu "người thừa kế mở lại ví qua social recovery khi công ty biến mất" (luồng ĐÃ chạy testnet). Câu chuyện trung thực cho giám khảo: thừa kế v1 = social recovery + heartbeat ladder; chia % theo bps là roadmap on-chain.

### D · Phụ trợ

**D1 · Lời nhắn mã hoá theo người nhận — ⛔ (ĐÃ HUỶ có chủ đích)**
- Bằng chứng: `docs/ROUTES.md:85` "letter … **N — ĐÃ HUỶ**"; `docs/THREAT-MODEL.md:14` "két di chúc ĐÃ HỦY (bất biến 3 ngủ tới khi quay lại)". 0 dependency mã hoá trong cả 2 package.json; grep `nacl|libsodium|shamir|recipient_pubkey|sealed` → 0 hit. Dấu vết duy nhất: entry `will_hash_anchored` treo ở event-router (:76).
- Cưỡng chế/Nên ở/Khoảng cách: quyết định sản phẩm, ghi roadmap — không phải nợ kỹ thuật giấu.

**D2 · Sổ đen gia đình — 🟡 (engine có, dữ liệu rỗng — hiệu lực = 0)**
- Bằng chứng: nhánh ưu tiên cao nhất trong engine `policy-engine.ts:34-40` (`blacklisted_recipient`, có test khoá); **cả 2 call-site truyền `blacklist: []`** (`service.ts:194, 349` — comment :340 tự nhận "chưa dựng"). Không bảng DB, không CRUD, không lan trong nhà. `docs/ROUTES.md:80` "Sau v1". Bẫy tên: FE `/block` là recovery veto, KHÔNG phải blacklist (`ROUTES.md:59`).
- Cưỡng chế: chưa ai. Nên ở: **BE** (reputation là dữ liệu gia đình off-chain; on-chain chỉ khi muốn chống-BE-chiếm).
- Khoảng cách: bảng + CRUD + nạp vào 2 call-site (~1 ngày).

**D3 · Lọc token rác / chặn trustline lạ — ⛔**
- Bằng chứng: KHÔNG THẤY (grep `trustline|changeTrust|asset filter|spam` → chỉ test SEP-45 dùng trustline làm ví dụ key SAI). Hệ hiện chạy đúng 1 asset native (`env.CONTRACT_ID_SAC_NATIVE`), chưa có bề mặt token để lọc. `ROUTES.md:81` "Sau v1".
- Nên ở: BE/FE (hiển thị + default-deny UX); ví C-address vốn không có trustline classic — bài toán thật là lọc token contract lạ khi hiển thị. Roadmap.

**D4 · Sổ giao dịch / xuất thuế — 🟡 (sổ xem có; export + tỷ giá ⛔)**
- Bằng chứng: sổ đọc có thật — `GET /api/audit/wallet/:walletId` keyset (`list-audit/handler.ts:10-14`) + FE `/wallet/history` (`history.tsx:1-3`). Export PDF/XLSX/CSV: 0 dependency (grep `xlsx|jspdf|csv|papaparse` → chỉ 2 hit "CSV" là parse env). Tỷ giá + nguồn + timestamp: KHÔNG THẤY — tiền lưu thuần stroops (`intents.schema.ts:8-9`).
- Nên ở: BE. Roadmap sau thi (P3).

**D5 · Audit log append-only — ✅ (mục cứng nhất repo)**
- Bằng chứng: 2 tầng Postgres — trigger chặn UPDATE/DELETE (`drizzle/0002`) + TRUNCATE (`0008`), và **REVOKE tầng role** `app_runtime` + PUBLIC (`0009:38-53`, kèm REVOKE CREATE ON SCHEMA); integration test mở connection bằng role runtime thật (`audit-runtime-role.integration.test.ts:9-11`). Xác nhận sống trên VPS (§3: trigger hiện diện trong `\d audit_log`).
- Phạm vi event ghi: **10 kind nội bộ** (`intent.awaiting_guardian`, `intent.guardian_approved`, `intent.submit_failed`, `intent.settled`, `intent.expired`, `recovery.onchain.submitted`, `guardian.health_changed`, `heartbeat.escalated`, `heartbeat.received`, `indexer.gap`) + **mirror MỌI event on-chain** (kind lạ → `unknown:<kind>`, `indexer.service.ts:204-216`).
- Khoảng hở: `before_hash`/`after_hash` có cột nhưng **không bao giờ được ghi** (không hash-chain); luồng quản trị guardian + recovery-config **không ghi audit** (xem §4-S3).

---

## 2.3 · SMART-ACCOUNT CÓ CHỖ CHO POLICY CHƯA — câu quan trọng nhất

**P-Q1 — CÓ, khung policy đã nằm trong ví đang tồn tại.** Interface on-chain của ví thật
`CD5QX3…` (`stellar contract info interface`, testnet) — **25 hàm public nguyên văn**:
`execute`, `add_policy`, `add_signer`, `extend_ttl`, `__check_auth`, `__constructor`,
`get_policy_id`, `get_signer_id`, `last_rotation`, `remove_policy`, `remove_signer`,
`recovery_rotate`, `add_context_rule`, `batch_add_signer`, `get_context_rule`,
`remove_context_rule`, `get_recovery_registry`, `set_recovery_registry`,
`apply_recovery_registry`, `get_context_rules_count`, `update_context_rule_name`,
`pending_recovery_registry`, `propose_recovery_registry`, `cancel_recovery_registry_change`,
`update_context_rule_valid_until`.
`ContextRule` có sẵn trường `policies: Vec<Address>` + `valid_until`. Nguồn: wrapper OZ
`stellar-accounts = "=0.7.2"` (`contracts/smart-account/Cargo.toml:15`), trait `SmartAccount` +
`ExecutionEntryPoint` (`lib.rs:320-324`).

**P-Q2 — `__check_auth` hiện kiểm:** (1) cooldown sau xoay khoá — chối MỌI chữ ký trong cửa sổ
(`lib.rs:298-315`); (2) uỷ toàn bộ còn lại cho `smart_account::do_check_auth` của OZ (:316) —
match context rule theo scope, verify signer (passkey qua origin-verifier), và **gọi `enforce` trên
từng policy contract gắn vào rule**. → Chỗ cắm điều kiện **số tiền / người nhận / thời gian** chính
là policy contract gắn qua `add_policy` + `valid_until` của rule. Có sẵn, chưa dùng
(ví hiện tại: 1 rule "owner", 0 policy).

**P-Q3 — trạng thái tiêu dùng theo ngày:** ví KHÔNG lưu — nhưng đây là thiết kế đúng của OZ:
policy `spending_limit` (có sẵn trong crate: `stellar-accounts-0.7.2/src/policies/spending_limit.rs`)
tự lưu **rolling window theo `period_ledgers`** (`SpendingLimitData { spending_limit, period_ledgers,
cached_total_spent }` + evict entry cũ) trong storage CỦA policy contract. Ledger time đọc được —
chính `lib.rs:280` đã dùng `e.ledger().timestamp()`. Ví dụ trong doc OZ: 10 XLM / 17280 ledgers (~1 ngày).

**P-Q4 🔴 — nâng cấp ví đang tồn tại: ĐƯỢC, không mất gì.** Vì `add_policy`/`add_context_rule`
đã live trên `CD5QX3…`, thêm policy = (1) viết crate mỏng wrap module OZ (`policies::spending_limit`
đã viết + test sẵn, chỉ cần vỏ `#[contract]`), (2) deploy policy contract MỚI (độc lập), (3) owner ký
`add_policy(rule_id=0, policy_addr, install_param)` bằng passkey hiện tại. **KHÔNG deploy lại ví,
KHÔNG đổi wasm ví, KHÔNG tạo ví mới, KHÔNG mất passkey/guardian đã mời.** Chi phí: rẻ–vừa (~1-2 ngày
gồm test). Nuance quan trọng: `spending_limit` của OZ là **deny-trên-limit** (tx fail), không phải
"trên ngưỡng → chuyển sang chờ guardian"; ngữ nghĩa "cần 1 người nhà gật đầu" on-chain cần thêm
context rule thứ hai có signer guardian (threshold 2) — bước sau, đắt hơn. (Interface KHÔNG có hàm
upgrade wasm — muốn đổi code ví phải deploy wasm mới và ví MỚI mới dùng nó; may là không cần cho policy.)

**P-Q5 — `ACCOUNT_WASM_HASH` pin ở 2 hệ:** FE build-time `VITE_ACCOUNT_WASM_HASH`
(`fe/apps/web/src/lib/env.ts:51`, dùng ở `features/wallet/lib/kit.ts:19,25`; giá trị bơm từ GitHub
Actions vars — `.github/workflows/deploy-fe.yml:125,150,175` có cả regex gate) và BE env
`ACCOUNT_WASM_HASH` (`be/src/env.schema.ts:154`, dùng bởi cron `jobs/ttl-keeper.ts:130-131` gia hạn
CODE entry). Đổi wasm → sửa **2 chỗ** (GH var + env VPS) + redeploy FE/BE; ví cũ vẫn chạy wasm cũ.

---

## 3 · DỮ LIỆU THẬT TRÊN VPS (chỉ SELECT; alias đúng là `vps-phonghoc`, user cdhc)

⚠️ Caveat: BE trên VPS **chưa chạy ae9cdd8** (nợ deploy L3 đã biết) — bằng chứng DB phản ánh bản
đang chạy; các kết luận A5/A6 đã đối chiếu khớp với code ae9cdd8.

**D-Q1 — 23 bảng:** `account, approval_requests, audit_log, care_grants, devices, families,
guardian_invites, guardians, heartbeats, heirs, indexer_checkpoint, indexer_events,
inheritance_plans, notifications, presence_pings, products, recovery_device_requests,
recovery_requests, session, transaction_intents, user, verification, wallets`.

Đối chiếu entity handoff §09:

| Entity handoff | Bảng thật | Ghi chú |
|---|---|---|
| TransactionIntent | ✅ `transaction_intents` | đủ cột spec + `client_intent_id`, `policy_*` |
| ApprovalRequest | ✅ `approval_requests` | đủ `challenge_hash, verified_call, decision, expires_at` + bind `intent_version` |
| RecoveryRequest | ✅ `recovery_requests` + `recovery_device_requests` | |
| CareGrant | ✅ `care_grants` (0 dòng) | bảng có, module BE rỗng (§2-B) |
| InheritancePlan | ✅ `inheritance_plans` + `heirs` (0 dòng) | versioned unique (wallet, version) |
| PrivateMessage | ⛔ **KHÔNG CÓ** | tính năng đã huỷ (D1) |
| AuditEvent | ✅ `audit_log` | append-only 2 trigger + REVOKE role; `before_hash/after_hash` NULL |

**D-Q2 — lệnh 10 XLM đang treo** (bảng `transaction_intents`, dán nguyên dòng):

```
id               = 01KYNEH5NRADJB3T6R26ZJXQSE      wallet_id = 01KYKV2Y514E7ZTDX4GYZ1ZBX2
status           = awaiting_guardian               created_by = owner · version = 1
operations       = [{"type":"sac_transfer","sac":"CDLZ…GCYSC","to":"CDBXNY…AR3PBT","amount":"100000000"}]
amount           = 100000000 (= 10 XLM)            recipient = CDBXNY…AR3PBT (chính là ví guardian)
policy_decision  = require_guardian                policy_reasons = ["unknown_recipient"] · policy_version = 1
intent_hash      = c6c8b708…7771b3
expires_at       = 2026-07-30 05:46:37+07  ← CÓ TTL (24h sau created_at 2026-07-29 05:46:37+07)
```

Phiếu duyệt đi kèm (`approval_requests`): `01KYNEH8TX…`, guardian `01KYMK2VFN…`,
`challenge_hash cd89cd1c…`, `decision = pending`, `expires_at = 2026-07-31 05:46 (+48h — lệch 24h so intent)`.

**Bằng chứng "guardian không nhận được gì":** bảng `notifications` có **đúng 1 dòng trong toàn bộ
lịch sử** — `presence.guardian_offline / push / failed / last_error = PUSH_NOT_CONFIGURED`
(22:00 28/07, TRƯỚC lúc tạo intent); 0 dòng sau `2026-07-29 05:00`. Audit_log có ghi
`intent.awaiting_guardian` (1) + `guardian.health_changed` (1) → hệ thống BIẾT sự kiện, chỉ không báo ai.
(Phụ: kênh push trên VPS cũng chưa cấu hình FIREBASE — kể cả nối code A5, cần bật email/sse hoặc cấu hình FCM.)

---

## 4 · ACCEPTANCE CHECKLIST (handoff §12 — 18 dòng)

| # | Dòng checklist | Đánh giá | Bằng chứng ngắn |
|---|---|---|---|
| 1 | Mỗi button có next/error-state | ❓ không kiểm phiên này | cần soát tay UI từng màn (ngoài phạm vi audit code) |
| 2 | Input thật bind vào review, hết fixture | 🟡 | send-flow bind state cục bộ thật (`use-send-machine.ts:169-176`); chưa soát hết mọi màn |
| 3 | AI không tạo sign request khi user chưa thấy recipient/amount | ⚪ N/A | AI chưa nối (`THREAT-MODEL.md:14`) |
| 4 | Policy decision trả reason codes | ✅ | `policy_reasons` jsonb + shared reason codes; DB thật: `["unknown_recipient"]` |
| 5 | Guardian approval bind intent hash+amount+recipient+expiry+policy version | ✅* | `computeChallengeHash` (`hashing.ts:54-63`) đủ 5 trường; `isApprovalBound` chặn 409; version mới giết phiếu cũ. *Hở: là bản ghi DB server-side — guardian KHÔNG ký gì (`dto.ts:24-27` chỉ `intent_id + verified_call`); BE bị chiếm thì phiếu giả được. `verified_call` chỉ ghi, không enforce |
| 6 | Owner signature bind canonical transaction bytes | ✅ | 4 lớp: FE `assertTransferEntry` so INPUT CỤC BỘ (`auth-entry-guard.ts:152-160`, cấm sub-invocation) → BE `validateSignedTransfer` (`transfer.ts:99-111`, fix P0-6) → gate ví phí → on-chain `__check_auth` re-simulate. Mạnh nhất repo |
| 7 | Mọi mutation có idempotency + audit | ⛔ | 19 endpoint mutation: idempotency đúng nghĩa **2/19**, audit **6/19**; toàn bộ quản trị guardian + recovery-config **0 audit** |
| 8 | Normal/large/gift/recovery có test happy+cancel+expiry | ⛔ | gift KHÔNG tồn tại; cancel KHÔNG tồn tại (A6); expiry có (sweeper + test) |
| 9 | Recovery alert ngoài app + veto từ kênh dự phòng | 🟡 | Email 2 đường độc lập CÓ THẬT (indexer + cron `recovery-watch` hỏi thẳng chain, `recovery-watch.ts:1-11`); veto endpoint + FE chống ký mù CÓ. Hở: **email không chứa link veto** (tự thú `indexer.service.ts:226`), veto vẫn cần app+passkey; không SMS/kênh 3; locale hard-code "en" |
| 10 | Reconnect/replace không hạ threshold/lockout | 🟡 | Sàn on-chain MIN_GUARDIANS=3/MIN_THRESHOLD=2 chặn đáy (`recovery-registry/src/lib.rs:69-74`); validate "không tạo lockout" ở BE invite/replace: KHÔNG THẤY kiểm riêng |
| 11 | Care grant allowlist+limit+expiry+audit+revoke | ⛔ | chỉ schema (§2-B) |
| 12 | Inheritance versioned; owner response huỷ pending execution | 🟡 | versioned schema + heartbeat reset tier CÓ; "pending execution" chưa tồn tại để huỷ (C6 ⛔) |
| 13 | Voice message mã hoá theo recipient | ⛔ | đã huỷ (D1) |
| 14 | Token lạ mặc định chặn | ⛔ | D3 |
| 15 | Receipt ledger/hash/fee/result | ❓ không kiểm phiên này | cần soát màn done + payload `intent.settled` |
| 16 | Keyboard/screen-reader/touch | ❓ không kiểm phiên này | |
| 17 | Nhãn "mô phỏng/lộ trình" còn nguyên | 🟡 | kiều hối/blacklist/tokens chưa build nên không cần nhãn; cần rà nhãn ở màn inheritance claim ("chỉ trình bày" đã ghi trong code) |
| 18 | Security review độc lập trước tài sản thật | 🟡 | audit nội bộ nhiều vòng (docs/security/AUDIT-2026-07-25.md, B-SEC-*); review ĐỘC LẬP bên ngoài: chưa |

**Đếm (15 dòng kiểm được):** ✅ 3 · 🟡 6 · ⛔ 5 · ⚪ 1 — và 3 dòng ❓ chưa kiểm (UI/receipt/a11y).

---

## 5 · NÊN Ở CONTRACT HAY BE

Nguyên tắc: *thứ kẻ chiếm được backend không được phép vượt qua → contract; tiện nghi/hiển thị → BE.*

| Tính năng (⛔/🟡) | Nên ở | Lý do một câu | Chi phí |
|---|---|---|---|
| A5 notify guardian | BE | thông báo là orchestration, không phải quyền | **rẻ** (1-2 ngày) |
| A6 cancel + TTL sync | BE | tiền chưa đi, chưa có chữ ký nào tồn tại | **rẻ** (0.5-1 ngày) |
| A1/A2 ngưỡng + hạn mức ngày | **contract** (spending_limit policy, §2.3) — bản BE giữ làm UX gate | BE bị chiếm không được phép nâng ngưỡng rút tiền | **vừa** (1-2 ngày, KHÔNG mất ví — P-Q4) |
| A7 owner ký đổi policy | contract (add/remove_policy vốn đòi ví tự ký — có sẵn) | đổi ngưỡng là thay đổi quyền | vừa (đi kèm dòng trên) |
| A8 re-eval context thật | BE | là logic đánh giá lại off-chain | **rẻ** (0.5 ngày) |
| A3 danh bạ verified | BE | reputation/UX, không phải quyền | vừa |
| B2-B6 care mode | **contract** (context rule + valid_until + allowlist policy) + BE orchestrate | mở quyền chi hộ mà chỉ BE giữ thì BE bị chiếm = tự cấp quyền chi | **đắt** (3-5 ngày; khuôn OZ có sẵn nhưng cần policy allowlist tự viết + luồng 2/3 off-chain→on-chain) |
| C4-C6 quorum/timelock/phân phối | **contract** | thừa kế là chuyển quyền tài sản — không được phụ thuộc BE sống | **đắt nhất** (contract mới + audit; KHÔNG kịp trong khung thi) |
| C7 ghi plan versioned | BE | metadata off-chain | rẻ |
| D2 blacklist | BE (v1) | dữ liệu gia đình, đổi thường xuyên | rẻ-vừa (1 ngày) |
| D4 export thuế | BE | báo cáo thuần | vừa, P3 |
| S3 audit cho guardian-admin | BE | nhật ký là off-chain | **rẻ** (0.5 ngày) |
| S1 guardian ký phiếu duyệt thật | contract dài hạn (context rule guardian) / BE ngắn hạn (guardian ký challenge bằng passkey, BE verify) | phiếu hiện là bản ghi DB — BE bị chiếm giả được | vừa (BE-verify) / đắt (on-chain) |

**Nói trung thực trong tài liệu thi (khuyến nghị nguyên văn):** *"Hạn mức và policy chi tiêu hiện
cưỡng chế ở tầng ứng dụng (versioned, bind vào phiếu duyệt); ví on-chain đã có sẵn khung policy của
OpenZeppelin (`add_policy` live trên ví đang chạy) — lộ trình đưa hạn mức xuống contract không cần
tạo lại ví. Thừa kế v1 = social recovery + heartbeat; phân phối % là roadmap on-chain."*
Không kịp làm ở contract trong khung thi: **B (care on-chain), C4-C6 (inheritance on-chain), S1 on-chain.**

---

## 6 · XẾP ƯU TIÊN

### 🔴 P0 — chặn dùng được / chặn demo
| Việc | Công |
|---|---|
| A5: enqueue `approval.requested` cho guardians + endpoint list phiếu + màn duyệt trong `/protecting` (+ bật kênh sse/email vì FCM chưa cấu hình) | 1-2 ngày |
| A6: endpoint cancel (transition đã có sẵn trong bảng) + đồng bộ TTL intent 24h vs phiếu 48h + notify khi expire | 0.5-1 ngày |

### 🟠 P1 — giám khảo sẽ hỏi
| Việc | Công |
|---|---|
| Verify contract: workflow release + tag trên mirror public (VERIFY-CONTRACT.md) | 0.5 (+1 nếu hash lệch) |
| A2+A8: bật dailyLimit thật + re-eval context thật | 1 ngày |
| Spending-limit policy on-chain gắn vào ví hiện tại (P-Q4 — điểm "BE chết vẫn an toàn", demo được ngay trên CD5QX3) | 1-2 ngày |
| S3: audit event cho mời/nhận guardian + recovery-config | 0.5 ngày |
| S4: nhét link veto vào email + locale vi | 0.5 ngày |

### 🟡 P2 — nên có, không chặn
D2 blacklist CRUD (1 ngày) · A3 danh bạ verified (1-2 ngày) · C7 luồng tạo/sửa plan + enforce tổng bps=10000 (1 ngày) · A9 giữ UUID double-tap phía FE (0.25) · trần 30 ngày + cron cho care schema (0.5, nếu quyết giữ care trong demo dưới dạng "coming soon").

### ⚪ P3 — roadmap sau thi
B care mode đầy đủ (on-chain) · C4-C6 inheritance on-chain · D1 két di chúc (đã huỷ, bật lại sau) · D3 lọc token · D4 export thuế + tỷ giá · kiều hối · S1 guardian ký phiếu on-chain.

**Nhận định thẳng về thời gian:** với quỹ thời gian còn lại, làm **P0 (A5+A6, ~2-3 ngày)** là bắt
buộc — không có nó, demo gửi-tiền-cần-duyệt chết ngay trước mặt giám khảo. P1 chọn theo sức:
**verify contract** (rẻ nhất, nhìn thấy ngay trên explorer) và **spending-limit on-chain**
(ăn điểm kiến trúc lớn nhất — chứng minh "BE sập không ai vượt được hạn mức" trên chính ví đang chạy).
B/C on-chain dứt khoát ghi roadmap, đừng cố — handoff §12 đã dặn: giữ nhãn "lộ trình" còn hơn giấu.

---

*Phiên audit không sửa dòng code nào — đầu ra đúng 2 file: `docs/AUDIT-TINH-NANG-2026-07-29.md`,
`docs/VERIFY-CONTRACT.md`. Lệnh fail / KHÔNG THẤY đáng ghi: `gh repo view msci2026vn/family-wallet`
(token thuộc account mirror — xác minh private bằng curl 404); `ssh vps-phonghoc-cdhc` không resolve
(alias đúng: `vps-phonghoc`); WebFetch trang validation stellar.expert bị 403 (thay bằng README
workflow + API); không chạy lại `stellar contract build` (dùng artifact 28/07 đã khớp hash on-chain).*
