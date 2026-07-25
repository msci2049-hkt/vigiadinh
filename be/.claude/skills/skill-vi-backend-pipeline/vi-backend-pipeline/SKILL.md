---
name: vi-backend-pipeline
description: >
  Backend Bun+Hono cho ví gia đình: state machine intent DRAFT→SETTLED (ai được chuyển state nào),
  idempotency chống double-submit, TTL/expiry cho draft-approval-challenge, re-run policy sau approval,
  schema approval binding, indexer getEvents có checkpoint (cửa sổ 7 ngày), guardian presence ladder
  (active/slow/offline + xác nhận tay 90 ngày), heartbeat thừa kế, notify đa kênh + veto ngoài app,
  audit append-only, và taxonomy lỗi "tiền đã đi chưa". Dùng khi: dựng route/job/schema cho luồng
  giao dịch, recovery, care, inheritance; viết indexer; sửa double-submit, approval hết hạn, mất event,
  báo động sai. Trigger: intent, state machine, idempotency, BullMQ, indexer, getEvents, checkpoint,
  presence, heartbeat, approval, audit log, notification, sequence conflict.
---

# Backend Pipeline — xương sống mọi luồng tiền

Stack chuẩn MSCI: Bun + Hono + Drizzle + Postgres + Dragonfly + BullMQ + Better Auth (chỉ phiên app,
**tuyệt đối không custody**). Skill này là phần nghiệp vụ đặt lên trên stack đó.

## 1 · State machine intent — MỘT pipeline cho mọi luồng tiền

```
DRAFT → VALIDATING → REVIEW → POLICY_GATE ─┬(known+dưới ngưỡng)→ AWAITING_SIGNATURE → SUBMITTING → SETTLED
                                            └(unknown/trên ngưỡng)→ AWAITING_GUARDIAN → APPROVED ─┐
nhánh chết: REJECTED | EXPIRED | CANCELLED | SUBMIT_FAILED — tiền KHÔNG rời ví                    │
                                    (re-run policy) ← APPROVED quay lại POLICY_GATE trước khi ký ◄┘
```

| Luật | Nội dung |
|---|---|
| P1 | **UI cấm gọi Stellar trực tiếp từ màn nhập liệu.** Mọi luồng (form LẪN giọng nói) đi qua pipeline này — AI chỉ tạo DRAFT, không đi xa hơn |
| P2 | Bảng transition tường minh: `(state, actor, action) → state'`. Actor = owner / guardian / system / AI. AI chỉ được `create_draft`, `request_clarify`. Chuyển state ngoài bảng = 409, ghi audit |
| P3 | **Re-evaluation:** sau `guardian.approved` PHẢI chạy lại policy trước `AWAITING_SIGNATURE` — số dư/recipient/policy có thể đã đổi. Approval cũ chỉ mở khoá, không thay chữ ký chủ ví |
| P4 | Owner sửa amount/recipient sau approval → intent **version mới**, approval cũ tự vô hiệu (binding theo hash — xem §3) |
| P5 | Policy decision trả **reason codes** để UI giải thích được — không trả boolean trần |

## 2 · Idempotency & TTL

- `intent_id` = UUID client sinh, unique index; POST lặp cùng id → trả bản ghi cũ, **không** tạo mới. Double-tap ký → Redis `SET NX EX` theo `intent_id` (bài calling-pro): tối đa MỘT tx.
- Submit: trước khi retry sau mất mạng, **query theo tx hash trước** — "Đang kiểm tra giao dịch đã lên mạng chưa", cấm đoán, cấm gửi lại mù.
- Sequence conflict → rebuild tx bytes → **chữ ký cũ invalid tự nhiên** (bind canonical bytes) → yêu cầu ký lại. Không tự ký hộ dưới mọi lý do.

| Thứ | TTL | Hết hạn thì |
|---|---|---|
| Draft | 24h | → EXPIRED, dọn bởi sweeper |
| Guardian approval | 15–60 phút (theo risk) | → EXPIRED; "Hằng cần kiểm tra lại vì yêu cầu đã hết hạn"; rotate challenge + re-run policy |
| Biometric challenge | 2–5 phút | quay lại REVIEW |
| Guardian offline khi đang chờ | — | cho owner **chọn** guardian khác hoặc huỷ — hệ thống **không tự hạ threshold**, không tự chuyển người |

Sweeper = BullMQ repeatable job, quét theo `expires_at`, mỗi lần quét ghi audit số lượng.

## 3 · Approval binding — schema chuẩn

```sql
approval_requests(
  id, intent_id, intent_version, guardian_id, guardian_device_id,
  challenge_hash,      -- H(intent_hash ‖ amount ‖ recipient ‖ policy_version ‖ expires_at)
  verified_call bool,  -- checkbox "đã gọi xác minh" — BẮT BUỘC khi risk ≥ ngưỡng
  decision, decided_at, expires_at
)
```
Xác nhận approval: server tính lại `challenge_hash` từ intent **hiện tại** — lệch = từ chối. Đây là chốt
chặn "approved=true tái dùng" (skill `stellar-security` K5). Guardian từ chối vì nghi lừa đảo → intent
REJECTED + gợi ý đưa recipient vào sổ đen gia đình.

## 4 · Indexer — mirror on-chain, KHÔNG được mất event

- Poll `getEvents` theo `contract_id` + topic; **cửa sổ RPC ≤7 ngày (mặc định node ~24h event)** → bảng `indexer_checkpoint(ledger_seq, cursor)` cập nhật MỖI batch; restart đọc checkpoint chạy tiếp.
- Dedupe theo **event id duy nhất** (RPC có thể trả trùng giữa các trang).
- Sập quá cửa sổ: **dựng lại mirror từ state contract hiện tại** + ghi bản ghi audit "lỗ hổng sự kiện từ ledger X→Y" — thừa nhận lỗ hổng, cấm đoán lấp.
- Mỗi event → cập nhật mirror + bắn notify tương ứng. Event tối thiểu phải xử lý: `intent.created`,
  `policy.evaluated`, `approval.requested`, `guardian.approved`, `signature.completed`,
  `transaction.settled`, `guardian.health_changed`, `recovery.vetoed`, `care.revoked`,
  và các event contract: `heartbeat`, `inheritance_opened`, `inheritance_claimed`, `will_hash_anchored`.
- `recovery.vetoed` = **ưu tiên cao nhất**: invalidate ngay request + sessions + device proof, trước mọi hàng đợi.

## 5 · Guardian presence — "người gác đêm" phía server

- BullMQ repeatable **12:00 theo múi giờ CHỦ VÍ**: silent push mọi thiết bị guardian → app trả `POST /presence/ack` chạy nền (người không bị phiền).
- Ladder: ack ≤24h = `active` · 24–72h = `slow` · >72h = `offline` → notify chủ ví NGAY ("Máy của Mẹ đã mất kết nối").
- **Xác nhận tay mỗi 90 ngày** (`last_manual_confirm_at`): push hỏi thật, chạm 1 cái — máy sống ≠ người còn ký được.
- `available_count == threshold` → cảnh báo "hết dự phòng"; `< threshold` → **đỏ: "ví hiện KHÔNG khôi phục được"** + chặn thao tác gỡ guardian tiếp (chống-lockout).
- `guardian.health_changed` phải **debounce** — mất mạng 5 phút không phải sự cố, đừng dội chuông cả nhà.
- **Riêng tư:** trạng thái online của guardian chỉ chủ ví thấy. Lộ ra ngoài = lộ thời điểm nên tấn công.

## 6 · Heartbeat thừa kế — server GỢI Ý, không bao giờ tự làm

Chu kỳ mặc định 30 ngày, 1 chạm "tôi vẫn khoẻ". Thang leo: 1 kỳ im lặng → nhắc dày hơn; 2 kỳ → hỏi qua
guardian; đủ `silence_secs` → server **gợi ý** guardian mở claim. **Mở claim là hành động on-chain của
guardian** — server không có quyền và không bao giờ tự kích hoạt (bất biến 2). Owner phản hồi bất kỳ lúc
nào trước execute → reset counter + cancel mọi pending + audit. Sau `inheritance_claimed` final: phát
Shamir shares cho heir ghép khoá K; API tải blob di chúc **chỉ mở sau final** (hoặc cho chính owner).

## 7 · Notify + Audit

- Đa kênh (push/email/SMS), template ICU theo **locale người nhận** (skill i18n §4); không secret trong payload; deep link SEP-7 cho ký.
- Recovery alert bắt buộc có **kênh ngoài app** và nút veto hoạt động từ kênh dự phòng.
- `audit_log` **append-only**: `actor_type, actor_id, device_id, event_type, object, before_hash, after_hash, occurred_at` — hiện thành "Nhật ký kiểm tra" trong app. Không UPDATE, không DELETE.

## 8 · Taxonomy lỗi — mỗi lỗi trả lời 2 câu: "tiền đã đi chưa?" + "làm gì tiếp?"

Cấm một toast chung. Bảng bắt buộc: AI nghe không rõ (không tạo signable tx) · trùng tên người nhận
(NEEDS_CLARIFICATION, hiện ảnh/quan hệ/đuôi địa chỉ) · thiếu số dư (fail TRƯỚC biometric, báo thiếu bao
nhiêu gồm phí) · approval hết hạn · mất mạng sau ký (query hash) · sequence conflict (ký lại) · care
grant hết hạn (auto-revoke, chặn khoản mới) · token lạ (default-deny trustline, nêu 3 rủi ro cụ thể).

## Cổng nghiệm thu cứng
1. Bảng transition có test phủ mọi `(state, actor)` cấm. 2. Double-tap + retry mất mạng: đúng MỘT tx trên testnet. 3. Sửa amount sau approval → approval chết, cần approval mới. 4. Kill indexer giữa batch, restart → không mất, không trùng event. 5. Guardian offline 4 ngày (giả lập) → chủ ví nhận cảnh báo đúng ladder. 6. Veto từ link email khi app bị "chiếm" (đăng xuất) vẫn chặn được recovery.
