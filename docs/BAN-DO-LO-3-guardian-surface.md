# BẢN ĐỒ LÔ 3 — bề mặt guardian C6–C10 (scan 28/07/2026, chưa build)

> Kết luận quan trọng nhất của scan: **checklist đánh giá sai hiện trạng.**
> "Phía guardian gần như chưa có màn nào" — thực tế CẢ NĂM mục C6–C10 đều đã có
> màn thật, có API thật, và e2e `family-screens.spec.ts` đang exercise chúng
> (inbox → approve-warning → approve). LÔ 3 vì vậy KHÔNG phải lô build màn mới —
> nó là lô **verify trên ví thật + vá 3 lỗ nối** liệt kê ở cuối.

## Hiện trạng từng mục

### C6 · Nhận lời mời — ✅ CÓ, trọn luồng

- Màn: `fe/.../routes/_authenticated/guardian/accept.tsx` — validateSearch
  `?token=`, đọc nhãn qua `inviteByTokenOptions` (public, rate-limit), nút
  Đồng ý → `createGuardianIdentity()` (passkey + deploy contract CỦA guardian)
  → `POST /invites/:token/accept` với địa chỉ.
- API: `be/.../guardians/features/invites/handler.ts` — `GET /invites/:token`
  (public) · `POST /invites/:token/accept` (requireAuth).
- Giao lời mời: KHÔNG có email — chủ ví copy link
  `origin/guardian/accept?token=…` từ `/setup/invite` (line 47) và tự gửi qua
  kênh riêng. Đây là quyết định sản phẩm chấp nhận được (link + nhãn, không lộ
  gì thêm), KHÔNG phải thiếu sót — ghi lại để khỏi "phát hiện" lại lần nữa.

### C7 · "Ví tôi đang gác" — ✅ CÓ (dạng hộp thư, không phải danh sách ví)

- Màn: `guardian/index.tsx` — đọc `GET /api/recovery/guardian` (inbox: yêu cầu
  pending trên các ví mình gác) + `GET /api/recovery/guardian/device-requests`
  (máy mới gõ cửa).
- Khác Argent: không có màn "danh sách TẤT CẢ ví tôi gác kể cả khi yên ắng".
  Query `guardians` theo `user_id` có index sẵn (`guardians_user_id_idx`) —
  nếu muốn thêm là 1 endpoint list + 1 section màn. **Đề xuất: KHÔNG làm cho
  bài thi** — hộp thư "khi cần mới thấy" đủ kể chuyện demo, danh sách tĩnh
  không thêm điểm.

### C8 · Duyệt recovery phía guardian — ✅ CÓ, cơ chế ký đã chốt

- Màn: `guardian/approve.tsx` (+ `approve-warning.tsx` cảnh báo theo QUY TẮC,
  `approved.tsx` kết quả có tx hash).
- Cơ chế ký (câu hỏi "khó nhất" của checklist — trả lời từ code thật):
  guardian ký bằng **passkey của chính họ qua contract CỦA HỌ** (danh tính tạo
  ở C6). Luồng: `buildRecoveryAction` (BE simulate `approve_recovery` trên
  registry, trả auth entries) → FE guard chống ký mù
  (`assertApproveRecoveryEntry`) → ceremony passkey trên máy guardian → `POST
  /api/recovery/submit` (BE = ví phí ký envelope, KHÔNG ký hộ entry).
  Registry xác thực guardian qua `__check_auth` của contract guardian.
- Còn thiếu: **chưa từng chạy trên ví thật** — e2e chỉ chạy mocked hoặc
  testnet-gated (spec multi-device hỏng vì sàn audit, xem nợ).

### C9 · "Tôi mất máy" từ máy mới — ✅ CÓ, đủ 6 màn public

- Route public `fe/.../routes/recovery/`: `index` → `find-wallet` → `sent` →
  `progress` → `countdown` → `done` (public CÓ CHỦ ĐÍCH — người mất máy chưa
  có session).
- API: `POST /api/recovery/public/device-request` (máy mới đăng ký khoá mới +
  fingerprint) · `GET /api/recovery/public/progress` (x/threshold + đếm ngược
  timelock — đúng yêu cầu C9).
- Guardian nhận "máy mới gõ cửa" ở inbox (`device-requests`) → `guardian/
  initiate.tsx` khởi tạo recovery on-chain sau khi xác minh bằng giọng nói
  (verifyNote bắt đọc fingerprint qua điện thoại — chống kẻ lạ gõ cửa).
- Điểm vào sau login trên máy mới: `/welcome` → "Tôi đã có ví" → luồng
  recovery. Không tự phát hiện "tài khoản có ví mà máy không có passkey" —
  chấp nhận được, CTA tay đã đủ.

### C10 · Veto phía chủ ví — ✅ CÓ màn, ❌ email KHÔNG deep-link

- Màn: `block/index.tsx` (đọc chain-truth THẲNG chain — comment đầu file nói
  rõ vì sao không tin mirror) → `block/confirm.tsx` (ký `cancel_recovery`,
  guard `assertCancelRecoveryEntry`) → `block/done.tsx` (tx hash).
- Email cảnh báo (`recovery-watch`, đường 2 độc lập indexer) — template
  `recovery.initiated` (`templates.ts:45`) CHỈ có text "block it now from any
  of your devices", **không có URL vào `/block`**. Người nhận mail phải tự mò.
  → Đây là lỗ nối số 1 của lô.

## Ba lỗ nối phải vá (thứ tự thi công đề xuất)

| # | Việc | Chỗ sửa | Cỡ | Rủi ro |
|---|---|---|---|---|
| N1 | Email `recovery.initiated` thêm link thẳng `https://<FE>/block` (+ APP_ORIGIN vào env template nếu chưa có) | `be/.../notifications/domain/templates.ts` + render kênh email | Nhỏ (BE-only) | Thấp — text template |
| N2 | Verify C8+C10 trên ví thật `CD5QX3…` — chạy trọn: mời 3 guardian thật → register → initiate → 2 approve → chủ ví veto. Đây là mục tiêu chính của phiên sau, cần 3 thiết bị/context + OTP thật | không sửa code trừ khi gãy | Người thật | Trung bình — lần đầu chạm chain thật cả chuỗi |
| N3 | e2e `multi-device-recovery.spec.ts` hỏng cấu trúc với registry đã audit (2 guardian < sàn 3, timelock 0 < sàn 86400, finalize không thể chờ 24h trong test) → cần **registry test-only** deploy riêng với sàn hạ, hoặc chuyển spec thành "tới-pending-thì-thôi" | spec + có thể contracts/scripts | Vừa | Trung bình |

Nợ ghi thêm ngoài lô: màn "ví tôi đang gác" dạng danh sách tĩnh (bỏ có chủ
đích) · C11 cooldown-explain (đã có `CooldownNotice` ở hub — kiểm đủ chưa ở
phiên C11) · thông báo in-app đồng bộ email (C24).

## Đối chiếu ràng buộc on-chain (không đổi được)

```
MIN_GUARDIANS = 3 · MIN_THRESHOLD = 2 · MIN_TIMELOCK_SECS = 86_400
threshold ≤ guardians.len() · cooldown 300s sau recovery_rotate
```

Mọi màn trên đã (sau LÔ 1) hoặc phải (khi build thêm) đọc các sàn này từ
`MIN_GUARDIANS`/`MIN_THRESHOLD` export — không hard-code số mới.
