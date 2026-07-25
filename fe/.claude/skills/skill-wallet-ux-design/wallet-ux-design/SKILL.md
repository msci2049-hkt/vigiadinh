---
name: wallet-ux-design
description: >
  Thiết kế UX/UI cho ví tiền điện tử phi giám hộ (self-custody): clear signing chống ký mù, vùng ngón
  cái, kích thước chạm cho người lớn tuổi, thang chữ riêng cho số tiền, taxonomy lỗi "tiền đã đi chưa",
  bảo mật màn khoá (không lộ số dư), passkey UX (hộp thoại OS chỉ hiện rpId), design token 3 tầng, và
  bộ nhận diện gia đình. Dùng khi: dựng/sửa bất kỳ màn nào của ví, thiết kế màn ký giao dịch, màn khôi
  phục, màn duyệt của người bảo hộ, review giao diện ví, chọn kích thước nút/chữ/khoảng cách, hay quyết
  hiển thị số tiền/địa chỉ/trạng thái. Trigger: giao diện ví, UI ví, UX ví, màn ký, clear signing, ký mù,
  blind signing, touch target, vùng ngón cái, thumb zone, số dư, số tiền, passkey UX, design token, mockup ví.
---

# Wallet UX Design — thiết kế ví mà mẹ dùng được, kẻ xấu không lừa được

Ví khác app thường ở một điểm: **một cú chạm sai là mất tiền không lấy lại được.** Mọi luật dưới đây
suy ra từ đó. Nguồn: Ethereum Clear Signing (ERC-7730, live 05/2026), WCAG 2.2 SC 2.5.8, HIG/Material,
nghiên cứu thumb-zone (Hoober), và các lỗ hổng đã tự tìm ra trong dự án.

## Câu hỏi thử vàng cho MỌI màn ký
> *"Thứ người dùng THẤY có đúng là thứ họ đang KÝ không?"*
Không chứng minh được là "có" bằng cách decode entry và so tại client → **màn đó chưa xong.** Đây là
nguyên nhân bug nghiêm trọng nhất từng gặp: 6/7 đường ký đưa entry của backend thẳng cho passkey, chỉ
kiểm địa chỉ credential — biến "đăng nhập" thành signing oracle.

## Tầng 1 — CLEAR SIGNING (chống ký mù) · quan trọng nhất

Ethereum Foundation gọi ký mù là *"điểm yếu lớn nhất của ví hiện nay"* — hàng tỉ đô mất vì nó, và
05/2026 Ledger/Trezor/MetaMask/Fireblocks đồng loạt chuyển sang clear signing. Ví này phải mặc định clear signing.

| # | Luật | Vì sao |
|---|---|---|
| CS1 | Màn ký hiện **plain-language**: *chuyển bao nhiêu · cho ai · phí bao nhiêu · quyền gì được cấp* | Không phải hex, không phải XDR thô. "Gửi 500 XLM cho CDEF…9XYZ, phí 0.00001" |
| CS2 | 🔴 Số tiền + người nhận **decode TỪ auth entry thật**, KHÔNG lấy từ echo của backend | So bản copy của kẻ tấn công với bản gốc của nó thì **luôn khớp**. Phải so với thứ **dẫn xuất tại client** từ tx đã simulate |
| CS3 | Người nhận lạ → gắn nhãn *"chưa có trong danh bạ"* | Phishing đổi đúng một ký tự địa chỉ |
| CS4 | Challenge passkey **dẫn xuất từ tx đã simulate**, không random | Random = chữ ký không ràng vào nội dung = ký mù ở tầng crypto |
| CS5 | ⚠️ **Hộp thoại passkey của hệ điều hành CHỈ hiện `rpId`**, không hiện số tiền/người nhận | Nên tóm tắt **phải** nằm trên màn app **trước** khi gọi passkey, ở **nửa trên** (sheet OS che nửa dưới). App phải làm việc mà OS không làm |
| CS6 | Sửa số tiền sau khi guardian duyệt → approval cũ **chết**, tạo phiên bản mới | Duyệt 1 XLM không được redeem thành 1,000,000 XLM |

## Tầng 2 — VÙNG NGÓN CÁI & KÍCH THƯỚC CHẠM · con số, không phải ý kiến

Nghiên cứu (MIT Touch Lab, ĐH Maryland): nút dưới 44px có tỉ lệ lỗi **gấp 3**. Người dùng ví này gồm
**người lớn tuổi** (ông bà làm người bảo hộ) — độ chính xác chạm giảm theo tuổi.

| Phần tử | Kích thước |
|---|---|
| **Nút hành động chính** | **56–64px** cao (HIG khuyến nghị 56–64 cho primary) |
| Phần tử chạm tiêu chuẩn | **≥48px** (Material 48dp) — KHÔNG dùng sàn WCAG 24px cho ví |
| Vùng chạm tối thiểu tuyệt đối | 44×44px, và phải có **spacing** — WCAG cho 24px chỉ khi đủ khoảng cách |
| Khoảng cách 2 phần tử chạm | 12px thường · **16px nếu cách mép màn <80px** (ngón cái vào góc nghiêng, dễ trượt) |
| Màn cho người lớn tuổi (guardian, heartbeat) | nút **64px**, chữ **18px**, khoảng trắng rộng |

**Vùng ngón cái trên màn 844px:**
```
y   0–100   với KHÓ nhất  → chỉ đặt trang trí, tuyệt đối không nút
y 100–560   đọc           → tiêu đề, thông tin, tóm tắt giao dịch
y 560–780   VÙNG VÀNG     → nút chính nằm đây, không nơi khác
y 780–844   safe area     → home indicator
```
🔴 Nút chính đặt **giữa màn theo chiều dọc** là lỗi trên điện thoại, dù trên desktop thì đúng.

Mã hoá vào token để designer/dev không phá được:
```ts
export const tap = { primary: 56, standard: 48, min: 44 } as const;
export const gap = { edge: 16, default: 12, tight: 8 } as const;  // tight chỉ cho target ≥44
```

## Tầng 3 — SỐ TIỀN CÓ THANG CHỮ RIÊNG

*"UI tài chính sống chết bằng độ đọc được của số."* Tách thang số ra khỏi thang chữ thường.

| Vai | Cỡ | Luật |
|---|---|---|
| Số dư | 40px, 700, **`tabular-nums`** | thập phân nhỏ 60% + grey; tabular kẻo số **nhảy** khi cập nhật |
| Số tiền giao dịch | 24px, 600, `tabular-nums` | |
| Địa chỉ / hash | 14px mono | **LUÔN rút gọn** `CAU2…XCWL`, KHÔNG bao giờ đủ 56 ký tự trên màn |

🔴 **Ba luật tiền bất khả xâm phạm** (sai là mất tiền thật, không phải xấu chữ):
1. **Ba trục độc lập:** ngôn ngữ UI ≠ locale định dạng số ≠ tài sản. (UI tiếng Anh, đứng ở VN, xem VND.)
2. Số on-chain giữ **BigInt string 7 chữ số thập phân** suốt pipeline; format `Intl.NumberFormat` locale
   **tường minh** chỉ ở **lá cuối** lúc render.
3. **CẤM parse ngược chuỗi đã format.** `"180.000"` đọc bằng `en-US` ra **180**. Ô nhập giữ raw ở state,
   hiển thị format **cạnh bên**, không dùng chung một chuỗi.

## Tầng 4 — BẢO MẬT MÀN KHOÁ

- 🔴 **KHÔNG hiện số dư / số tiền trên màn CHƯA mở khoá.** Nhìn lén màn hình là **bước dạo đầu của cả tấn
  công số lẫn tấn công thân thể** (wrench attack — cưỡng ép thể chất, kỷ lục 2025). Luật ngành: đừng
  quảng cáo mình có bao nhiêu.
- Được hiện: **tên ví** (người lớn tuổi cần biết vào đúng chỗ — giá trị dùng > rủi ro), địa chỉ rút gọn,
  nhãn mạng (`Testnet`).
- Màn khôi phục (chưa xác thực): tìm ví ra kết quả **không** kèm số dư.

## Tầng 5 — TAXONOMY LỖI "TIỀN ĐÃ ĐI CHƯA"

🔴 **Cấm một toast chung cho mọi lỗi.** Mỗi lỗi phải trả lời **hai câu**: *tiền đã rời ví chưa* và *làm gì tiếp*.

| Loại | Nền | Khi | Ví dụ câu |
|---|---|---|---|
| `info` | trắng | không ảnh hưởng tiền | |
| `warn` | vàng nhạt | cần người dùng quyết | "Vượt hạn mức — cần Mẹ duyệt" |
| `pending` | trắng + spinner | **đang kiểm tra tiền đã lên mạng chưa** | "Đang kiểm tra giao dịch…" |
| `error` | trắng, viền đỏ, chữ đen | thất bại, tiền **CHƯA** rời ví | "Không đủ số dư. Thiếu 5 XLM gồm phí" |

Các case bắt buộc phân biệt: thiếu số dư (chặn **trước** biometric, báo thiếu bao nhiêu **gồm phí**) ·
người nhận trùng tên (hiện đuôi địa chỉ + quan hệ) · mất mạng sau ký (**query hash**, cấm gửi lại mù) ·
sequence conflict (ký lại, chữ ký cũ tự vô hiệu) · double-tap (khoá → 1 tx) · approval hết hạn (rotate
challenge + re-run policy).

⚠️ **Đỏ chỉ dùng khi "tiền đã đi + sai".** Vân tay không nhận, guardian offline, vượt hạn mức → **vàng**,
không phải đỏ. Đỏ khắp nơi thì người dùng ngừng đọc đỏ.

## Tầng 6 — PASSKEY UX

- Màn khoá **không có ô mật khẩu.** Hành động chính = **một** nút sinh trắc học. Đặt passkey làm nút phụ
  dưới một form khác là **anti-pattern** (dữ liệu eBay/Microsoft: passkey mặc định → +120% xác thực).
- Cấm trên mọi màn: ô mật khẩu · seed phrase · OTP · SSO · QR-login — nếu sản phẩm là passkey-only.
- Nút phụ **duy nhất** được phép trên màn khoá: **"Mất máy? Khôi phục ví"** — và phải nhìn thấy được,
  vì với ví thì khôi phục là đường sống.
- Trạng thái vân tay lỗi: giọng an ủi, **vàng** không đỏ, gợi ý thử lại. Mascot tư thế an ủi > dòng chữ đỏ.
- Có ô định danh → `autocomplete="webauthn"` bật **Conditional UI** (passkey gợi ý trong dropdown autofill)
  — đòn tăng tỉ lệ dùng passkey mạnh nhất.

## Tầng 7 — HIỂN THỊ NIỀM TIN & CON NGƯỜI

- **Chùm avatar người bảo hộ là điểm neo cảm xúc, KHÔNG phải người mẫu.** 3 vòng chồng nhau, badge khiên
  vàng, offline thì xám hoá. Nói được *"những người này giữ chìa khoá ví của bạn"* — thứ ảnh người mẫu
  không nói được. Và nó là **thông tin thật**, không trang trí.
- 🔴 **Nhân vật người (mẫu) CHỈ dùng ở landing/onboarding/pitch. CẤM trên màn dùng hằng ngày.** Màn gặp
  5–10 lần/ngày: người lạ toàn thân tuần 1 đẹp → tuần 3 ngứa mắt. Không ví nào (MetaMask, Revolut, Apple
  Pay) đặt người trên màn mở khoá.
- **Mascot gắn TRẠNG THÁI, không gắn màn.** Luôn hiện = giấy dán tường. Hiện khi có điều cần nói = tính
  năng. Người mới → có; người quay lại → không.
- **Địa chỉ ví luôn `C…`** (contract account). `G…` là classic — với ví passkey thì đó là tự khai sai
  kiến trúc, giám khảo bắt ngay.

## Tầng 8 — TOKEN & NHẤT QUÁN (nền, làm một lần)

3 tầng: primitive → semantic → component. **Cấm hard-code giá trị trong component** — đổi brand một chỗ.
- Màu: tỉ lệ **70% nền · 20% mực · 10% nhấn**. Màu nhấn là gia vị. Xanh/đỏ **chỉ** cho trạng thái cuối.
- Contrast: đạt WCAG AA. ⚠️ **màu nhấn vàng trên trắng KHÔNG đạt** → chữ trên nút nhấn phải **tối/đen**.
- Icon: **một** bộ, **một** độ dày nét, mỗi khái niệm **một** icon xuyên toàn app (guardian luôn cùng một
  icon). `currentColor`, cấm nhiều màu, cấm emoji trong UI.
- Chữ: `line-height` — body ≥1.5, **tiếng Việt ≥1.45** (dấu ế/ộ/ữ bị cắt ngọn nếu chặt). Tiếng Việt dài
  hơn tiếng Anh **30–50%** → test nút không tràn ở màn dài nhất, cả 3 ngôn ngữ.
- Motion: nhẹ, ổn định — "giữ nhịp khi tiền đang di chuyển". `prefers-reduced-motion` tắt hết.

## Tầng 9 — TIMELOCK & THỜI GIAN

- `TimelockCountdown` hiện **CẢ HAI**: đếm ngược (`23:14:02` mono tabular) **và** mốc tuyệt đối
  (*"đến 14:30, 26/07"*). Chỉ đếm ngược thì người dùng không biết là mấy giờ.
- Cửa chờ (recovery timelock, cooldown) là **tính năng bảo vệ** — copy phải nói *vì sao*, không phải
  "hệ thống đang xử lý".
- 🔴 **Màn sau khôi phục phải giải thích cooldown**: còn bao lâu · vì sao ("chặn kẻ vừa chiếm ví rút
  ngay") · làm gì được / chưa được. Người vừa cứu ví thấy "ví bị khoá" không rõ tới bao giờ = khoảnh
  khắc lo lắng nhất của cả sản phẩm.

## Cổng nghiệm thu một màn ví (thiếu 1 = chưa xong)
1. Màn ký: số tiền + người nhận **decode từ entry thật**, đối chiếu client, hiện plain-language.
2. Nút chính 56–64px, nằm `y 560–780`.
3. Màn có sinh trắc học: tóm tắt ở **nửa trên**, có sheet OS che nửa dưới.
4. Màn chưa mở khoá: **0 số dư**.
5. Địa chỉ `C…`, rút gọn. Số tiền `tabular-nums`, format ở lá cuối, không parse ngược.
6. Lỗi phân đúng 4 loại, mỗi lỗi trả lời "tiền đã đi chưa". Đỏ chỉ khi tiền-đã-đi-và-sai.
7. Chữ trên nút nhấn là tối. Contrast AA. `line-height` tiếng Việt ≥1.45.
8. Nhân vật người không xuất hiện trên màn dùng hằng ngày.
