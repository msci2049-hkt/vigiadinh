---
name: fw-indexer-notify
description: "Indexer sự kiện Stellar và hệ thông báo đa ngôn ngữ của FamilyWallet: poll getEvents có checkpoint (RPC chỉ giữ ~7 ngày), mirror trạng thái on-chain vào Postgres, phát thông báo push/email/SSE theo template ICU, deep link SEP-7. Dùng skill này khi đụng đến: indexer, getEvents, event contract, mirror on-chain, checkpoint ledger, notification, thông báo đa ngôn ngữ, ICU MessageFormat, SEP-7, deep link ký giao dịch, audit log, nhật ký kiểm tra."
---

# FamilyWallet — Indexer & Notifications

Backend không bao giờ là nguồn sự thật — **chain là nguồn sự thật, Postgres là bản mirror để đọc nhanh**. Indexer là sợi dây nối hai bên; notification là cách con người biết chuyện gì vừa xảy ra on-chain.

## INDEXER — luật vàng
1. **RPC chỉ giữ ~7 ngày lịch sử.** Worker chết 8 ngày là MẤT event vĩnh viễn nếu không xử: lưu `checkpoint(last_ledger, last_event_id)` vào Postgres sau MỖI batch; khởi động đọc checkpoint chạy tiếp. Nếu gap > cửa sổ RPC → chạy backfill qua Horizon/archive RPC rồi mới poll tiếp, và log cảnh báo đỏ.
2. Poll `getEvents` theo `contract_id` + topic filter, batch 5–10s (BullMQ repeatable, chống trùng bằng `jobId`).
3. **Idempotent tuyệt đối:** event unique theo `(tx_hash, event_index)` — unique index trong DB; xử lại không tạo notification đôi.
4. Mirror bảng `recovery_requests`, `inheritance_state`, `will_anchors` từ event — mọi cột đều suy ra được từ chain; nghi sai thì re-index, không sửa tay.
5. Mọi event an toàn ghi vào `audit_log` → chính là màn "Nhật ký kiểm tra" trong app.

## MAP EVENT → HÀNH ĐỘNG
| Event | Làm gì |
|---|---|
| `recovery_initiated` | gọi risk engine → notify guardian (kèm score) + notify MỌI thiết bị owner (nút VETO) |
| `recovery_approved` | cập nhật đếm phiếu, SSE realtime màn tiến độ |
| `recovery_finalized` | notify hai phía; nhắc bước ký SetOptions (Phase 1–2) |
| `recovery_cancelled` | notify guardian "chủ ví đã hủy — có thể là giả mạo, hãy cảnh giác" |
| `heartbeat` | reset đồng hồ thừa kế |
| `inheritance_opened/approved/finalized` | thang notify riêng, giọng khác (tang gia — xem UX) |
| `will_hash_anchored` | cập nhật `will_anchors`, hiện tick "đã ghi dấu" + link explorer |

## NOTIFICATION — kiến trúc
- Một hàm phát duy nhất `notify(user_id, template_key, params, channels[])`; kênh: push (FCM/APNs), email (resend), SSE. Ưu tiên: sự kiện an toàn = push + email; tiến độ = SSE + push nhẹ.
- **Template ICU MessageFormat** theo `locale` của TỪNG NGƯỜI NHẬN (guardian ở 3 nước nhận 3 thứ tiếng — cùng một event). Không hardcode chuỗi; key trùng hệ i18n FE để đỡ dịch hai lần.
- Giọng theo ngữ cảnh: recovery = khẩn, rõ; inheritance = chậm, trang trọng; presence = trung tính. Cấm chữ kỹ thuật (multisig, threshold, XDR) trong mọi bản gửi người dùng.
- Chống bão: gộp (digest) các event tiến độ trong 5 phút thành 1 push; sự kiện VETO-được thì KHÔNG BAO GIỜ gộp, đi ngay.
- Deep link: push mở đúng màn (`familywallet://recovery/<id>`); với ví ngoài (LOBSTR) dùng SEP-7 `web+stellar:tx?xdr=...` cho bước ký.

## RETRY & ĐỘ TIN
Push token chết (uninstall) → mark device dead sau 3 lần fail, rớt về email. Email qua BullMQ retry 5 lần backoff. Mọi notification ghi `notifications(status: queued/sent/failed)` — màn debug admin đọc bảng này.

## NGHIỆM THU
- [ ] Tắt worker 2 phút giữa chừng demo → bật lại không mất, không đôi notification
- [ ] Cùng event `recovery_initiated`: owner nhận bản có nút VETO, guardian nhận bản có score — đúng locale từng người
- [ ] Giả event trùng (re-poll) → DB không đổi, không notify lại
- [ ] Checkpoint tồn tại và tăng đơn điệu sau mỗi batch
