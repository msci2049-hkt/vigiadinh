# Cron ping 12:00 — CHƯA DỰNG (ghi nhận, đúng kế hoạch bootstrap)

## Vì sao chưa có

Template BE **KHÔNG có repeatable job nào**:
- `src/lib/redlock.ts` khai `redlock` nhưng **không file nào import** (mồ côi).
- 2 job cũ của lớp demo carbon đều **enqueue theo sự kiện**, không theo lịch — và đã xóa
  cùng `src/jobs/` khi bootstrap.

→ Ping 12:00 hằng ngày cho người bảo hộ phải **dựng mới**, không có gì để sửa lại.

## Dựng theo

Skill `.claude/skills/new-cron/SKILL.md` (template) + `.claude/skills/fw-guardian-presence/SKILL.md`
(nghiệp vụ: thang trạng thái active/slow/offline, xác nhận tay 90 ngày, cảnh báo hết dự phòng).

## Ràng buộc BẮT BUỘC (đừng quên, phá là hỏng)

1. **Tên queue phải có `{ngoặc nhọn}`** — vd `{presence-ping}`. Thiếu → Dragonfly serialize Lua
   script về 1 thread, throughput sập. `bun run check:boundaries` chặn literal thiếu hashtag
   (tên truyền bằng biến thì KHÔNG kiểm được — gap đã biết).
2. **`attempts: 1` cho cron** — cron phải idempotent, không retry mù.
3. **Leader lock**: `redlock.using([key], ttl, ...)` bọc handler — cluster N process, không lock
   là ping chạy N lần. Đây chính là lý do `redlock.ts` tồn tại.
4. **`jobId` KHÔNG chứa `:`** — BullMQ dùng `:` làm namespace Redis (BUG-007 cũ). Dùng `-`.
5. **Timezone**: `repeat: { pattern, tz }` — nhưng FamilyWallet là sản phẩm TOÀN CẦU:
   ⚠️ **KHÔNG hardcode 1 timezone.** "12:00" phải là 12:00 **theo giờ của từng người bảo hộ**.
   → hoặc chạy cron mỗi giờ rồi lọc guardian có `local_hour == 12`, hoặc lưu timezone/offset
   trên `devices`/`guardians` và tính giờ gửi. Chốt cách làm trước khi code (schema hiện CHƯA
   có cột timezone — sẽ cần migration).
6. Worker chạy **process riêng** (`bun run worker`), đăng ký ở `src/workers/index.ts`.

## Liên quan

- Bảng đã có sẵn: `presence_pings` (guardian_id, device_id, sent_at, acked_at), `devices`
  (push_token, fingerprint_hash — đã vào redact list của pino).
- Gửi silent push (FCM/APNs) — `firebase-admin` đã cài, **chưa nối dây**.
