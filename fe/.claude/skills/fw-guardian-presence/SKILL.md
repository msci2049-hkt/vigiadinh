---
name: fw-guardian-presence
description: "Hệ theo dõi kết nối người bảo hộ của FamilyWallet: silent push 12:00 hằng ngày, thang trạng thái active/slow/offline, xác nhận tay 90 ngày, cảnh báo hết dự phòng, luồng nối lại máy mới. Dùng skill này khi đụng đến: guardian presence, ping 12h, kiểm tra kết nối người thân, mất kết nối, silent push, heartbeat guardian, available_count, guardian offline, nối lại máy mới, BullMQ repeatable job, trạng thái người bảo hộ."
---

# FamilyWallet — Guardian Presence

Trả lời một câu hỏi duy nhất, liên tục: **"ngay bây giờ, bao nhiêu guardian THỰC SỰ ký được?"** — vì social recovery chết thầm lặng khi guardian mất máy mà không ai biết.

## HAI TẦNG KIỂM TRA — không được gộp
1. **Máy sống (tự động, mỗi ngày):** BullMQ repeatable job theo múi giờ chủ ví, 12:00 bắn **silent push** (FCM data-message / APNs `content-available`) tới mọi thiết bị guardian → app chạy nền gọi `POST /presence/ack {device_id}`. Người KHÔNG bị làm phiền.
2. **Người còn ký được (tay, mỗi 90 ngày):** push hỏi thật, guardian chạm 1 cái (yêu cầu biometric) → `last_manual_confirm_at`. Lý do tách: máy trong túi con cháu vẫn online, nhưng bà đã không còn mở được app — ping chứng minh MÁY, cái chạm chứng minh NGƯỜI.

## THANG TRẠNG THÁI (CHECK constraint, không enum)
```
ack ≤ 24h        → active
24h < ack ≤ 72h  → slow      (chấm vàng, chưa báo)
> 72h            → offline   (chấm đỏ, notify chủ ví NGAY)
manual > 100 ngày → stale_manual (nhắc xác nhận tay)
```
Silent push bị OS bóp (Doze/Low Power) → **72h mới kết luận offline**, đừng báo động ở 24h; và ack bất kỳ (mở app, bấm notification) đều tính.

## available_count — con số quyết định
`available = đếm(active ∪ slow)`. So với threshold ví:
- `available > threshold` → ổn.
- `available == threshold` → cảnh báo vàng **"hết dự phòng"** — thêm 1 người mất máy nữa là ví không khôi phục được.
- `available < threshold` → cảnh báo ĐỎ **"ví hiện KHÔNG khôi phục được"** + đề xuất hành động (thêm/thay guardian).
Tính lại mỗi lần trạng thái đổi, đẩy realtime qua SSE (template BE có sẵn kênh `sse:user:{id}`).

## LUỒNG NỐI LẠI MÁY MỚI (guardian đổi điện thoại)
1. Chủ ví (hoặc guardian từ máy mới) yêu cầu link mời-lại → token một-lần, hết hạn 72h.
2. Guardian mở link trên máy mới → passkey mới → server map device mới vào guardian cũ, **vị trí on-chain KHÔNG đổi** (chỉ đổi khi guardian đổi KEY ký on-chain — lúc đó phải qua add/remove guardian trên contract).
3. Notify chủ ví: "Mẹ đã kết nối lại · 3/3 sẵn sàng".
Ba lối xử lý khi offline (đúng mockup): gửi mời máy mới / thay người khác (contract `remove_guardian` + `add_guardian`) / bỏ qua chờ tự nối lại.

## RIÊNG TƯ — luật cứng
- Trạng thái online của guardian **chỉ chủ ví thấy**. Lộ ra ngoài = lộ thời điểm nên tấn công.
- Không lưu vị trí, không lưu IP quá 30 ngày, ack chỉ chứa device_id + timestamp.

## SCHEMA TỐI THIỂU
`guardians(id, wallet_id, user_id?, status, last_seen_at, last_manual_confirm_at, onchain_key)` · `devices(id, guardian_id/user_id, platform, push_token, fingerprint_hash, created_at)` · `presence_pings(id, guardian_id, sent_at, acked_at?, device_id?)` — pings giữ 90 ngày rồi cuộn vào thống kê.

## NGHIỆM THU
- [ ] Ping 12:00 đúng múi giờ chủ ví (test 2 múi giờ khác nhau)
- [ ] Máy tắt mạng 3 ngày → offline + notify chủ ví đúng 1 lần (không spam)
- [ ] Bật mạng lại → tự về active, notify "đã kết nối lại"
- [ ] available_count == threshold → banner hết dự phòng xuất hiện
- [ ] Nối máy mới: token một-lần không dùng lại được
