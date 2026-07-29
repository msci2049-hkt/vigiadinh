# Địa chỉ nhận tiền — vì sao KHÔNG có ô memo (đọc trước khi đụng màn Gửi)

> 2026-07-29 (LÔ 4). Phiên sau định "thêm ô memo cho sàn" thì đọc hết file này trước.

## Kỹ thuật nền

Ví FamilyWallet là **contract account (`C…`)**. Giao dịch đi bằng lệnh gọi hàm
`transfer(from, to, amount)` của SAC (Soroban) — **không phải payment classic** →
**trường memo không tồn tại** trong loại giao dịch này. Thêm ô memo vào UI là hứa
một điều pipeline không chở được.

Cách đúng theo tài liệu Stellar (SEP-23 M-strkey, CAP-27): dùng **địa chỉ muxed
`M…`** — nó mã hoá SẴN tài khoản nhận (G…) + id khách hàng trong MỘT chuỗi, thay
thế memo. Sàn lớn (Kraken…) đã hỗ trợ `M…` cho nạp/rút.

## Trạng thái hỗ trợ hiện tại (2026-07-29)

| Dạng | Nhận diện (StrKey checksum) | Gửi được? |
|---|---|---|
| `C…` contract | ✅ `classifyAddress` = `contract` | ✅ |
| `G…` classic | ✅ = `classic` | ✅ |
| `M…` muxed | ✅ = `muxed` + chú thích "đã kèm mã nhận diện của sàn" | ⛔ **chưa** — chặn với câu hướng dẫn, KHÔNG im lặng nuốt |
| khác / sai checksum | `invalid` | ⛔ báo lỗi ngay khi gõ |

Nguồn: `fe/apps/web/src/features/family/lib/address.ts` (+ test) và
`features/family/components/recipient-field.tsx`.

Vì sao `M…` chưa gửi được: tầng dưới chặn ở **BE dto** (`^[GC][A-Z2-7]{55}$` —
`be/src/modules/intents/features/send-flow/dto.ts` + `domain/transfer.ts`).

## Muốn mở `M…` thật sự thì làm gì (đường đi cho phiên sau)

1. BE dto + `transferArgs`: nhận `M…`; dựng `ScAddress` muxed cho tham số `to`
   của SAC `transfer` (CAP-67 — cần xác nhận bản protocol/SDK đang chạy hỗ trợ).
2. Kiểm bằng tx thật trên testnet: SAC transfer tới `M…` và đối chiếu sàn/chỉ mục
   ghi nhận đúng id khách.
3. Chỉ khi (1)+(2) xong mới đổi `isSendableAddress` cho `muxed` = true — câu chú
   thích trên UI giữ nguyên.

**Cấm**: thêm ô memo UI; "hỗ trợ M…" bằng cách lột M ra G rồi gửi vào G trần
(tiền tới sàn nhưng KHÔNG có id khách → mất tiền trong kho sàn — tệ hơn cả chối).
