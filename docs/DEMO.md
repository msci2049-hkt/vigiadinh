# DEMO — kịch bản trình diễn

> Viết theo đúng thứ CÓ TX THẬT, không theo số pha đã làm. Mọi mục dưới đây đều
> trỏ được tới một giao dịch trên testnet (`docs/evidence/TESTNET.md`).
> Cập nhật 2026-07-25.

## Kịch bản chính — "mất điện thoại" (mạnh nhất, diễn 4 phút)

Đây là câu chuyện nên diễn, vì nó là thứ mọi ví khác KHÔNG làm được.

| Phút | Diễn gì | Nói gì |
|---|---|---|
| 0:00 | Mở ví trên "điện thoại cũ", cho thấy số dư | "Ví này không có seed phrase. Chưa từng có." |
| 0:30 | **Bỏ điện thoại xuống** — coi như mất | "Đây là lúc mọi ví khác kết thúc." |
| 0:45 | Máy mới → `/recovery` → chạm vân tay tạo khoá mới | "Máy mới, vân tay mới. Chưa ai cho tôi vào ví cả." |
| 1:30 | Máy của **mẹ** → mở yêu cầu, đọc vân tay khoá mới qua điện thoại | "Mẹ đọc mã này cho tôi nghe, tôi đối chiếu — kẻ giả mạo không qua được bước này." |
| 2:15 | Máy của **anh** → chạm vân tay duyệt | "Hai người là đủ. Không ai trong hai người tiêu được tiền của tôi." |
| 3:00 | Hết thời gian chờ → hoàn tất | **"Địa chỉ ví không đổi. Tiền còn nguyên. Chỉ khoá bên trong đổi."** |
| 3:30 | Thử ký bằng khoá CŨ → bị chối | "Điện thoại mất giờ vô dụng với ví này." |
| 3:45 | Chỉ vào thông báo thời gian bảo vệ | "Ví nghỉ 24 giờ. Nếu kẻ xấu vừa chiếm được, đây là thứ chặn nó rút ngay." |

**Bằng chứng đứng sau** (mở sẵn tab stellar.expert):
`docs/evidence/TESTNET.md §AUDIT P0` — 12 tx, gồm khoá mới ký được tx thật
(`b675f53b…`), khoá cũ bị chối, cooldown chặn ngay sau finalize.

## Kịch bản phụ

1. **Gửi tiền bằng vân tay** — `/wallet/send`, 1 XLM, người nhận nhận đủ.
   Bằng chứng: tx `e83adb27…` — passkey secp256r1 → `__check_auth` →
   origin-verifier → SAC transfer, **MỘT giao dịch**.
2. **Chặn khẩn cấp** — `/block`: chủ ví thấy yêu cầu khôi phục mình không hề mở,
   một nút chặn. Màn này đọc **thẳng từ chain**, nên vẫn báo đúng kể cả khi
   indexer chết.

## Ba điểm bán (nói đúng thứ tự này)

1. **Không có seed phrase, ký bằng vân tay** — và đó là chữ ký thật trên chuỗi,
   không phải đăng nhập rồi server ký hộ. Tx `e83adb27…` chứng minh.
2. **Một passkey xuyên ba vỏ** (web · APK · extension) — một khoá, ba origin,
   verifier nhận cả ba, origin lạ bị chối `Error(Contract,#5)`. GATE 3 spike.
3. **Hai người nhà thông đồng KHÔNG chiếm được ví** — đây từng là lỗ hổng
   không vá được bằng code, và nó được diệt bằng **kiến trúc**: ví là hợp đồng
   (không phải multisig cổ điển), có thời gian chờ để chủ ví kịp chặn, có quyền
   veto của chính ví, và có thời gian bảo vệ sau khi xoay khoá. Người bảo hộ
   không bao giờ là người ký trên ví chủ — họ chỉ bỏ phiếu ở registry.

> Câu thử vàng ban giám khảo hay hỏi: *"chiếm được backend thì làm gì được?"*
> Trả lời: backend không giữ khoá nào của người dùng. Quyền duy nhất registry có
> trên ví là đúng một cửa `recovery_rotate`, và cửa đó vẫn phải qua ngưỡng
> người nhà + thời gian chờ + veto. Grep `Keypair.fromSecret|.sign(` ngoài test
> chỉ ra ví phí và khoá server SEP-45 — **0 chỗ ký hộ người dùng**.

## Nói RÕ cái chưa demo được (đừng hứa quá trên sân khấu)

- **Chưa lên mainnet.** Toàn bộ chạy trên testnet. Còn chờ tên miền + khoá thật.
- **Chưa chạm phần cứng sinh trắc học thật.** Passkey trong mọi bằng chứng là
  authenticator ảo của Playwright — ceremony `navigator.credentials` là thật,
  crypto secp256r1 là thật, nhưng chưa có ngón tay người nào chạm cảm biến.
- **Chưa có APK/iOS build.** Cấu hình Capacitor + fingerprint keystore đã sẵn,
  chưa build trên máy có JDK/Xcode.
- **AI "người gác đêm" chưa nối.** Cảnh báo hiện tại là **rule thuần**, và UI
  ghi đúng nhãn "không phải AI". Đừng gọi nó là AI trên sân khấu.
- **Vài màn còn stub**: xem `docs/COVERAGE-PRODUCT.md` (3 mục 🟡) — thay người
  bảo hộ, đổi registry, nối thêm thiết bị.

## Chuẩn bị trước khi diễn

```bash
# 1. Docker (postgres + dragonfly) + BE + FE
cd be && bun run dev          # cửa sổ 1
cd be && bun run worker       # cửa sổ 2
cd fe && pnpm dev:web         # cửa sổ 3

# 2. Ví demo phải tạo bằng bản wasm MỚI — ví cũ KHÔNG khôi phục được
#    (xem docs/evidence/TESTNET.md §P0 CONSTRUCTOR-REGISTRY)
```

⚠️ **Đừng demo trên ví tạo trước 2026-07-24.** Ví tạo bằng wasm `a67ea40e…`
chưa từng được cắm registry — bấm khôi phục sẽ chết mã 100 trên sân khấu.
