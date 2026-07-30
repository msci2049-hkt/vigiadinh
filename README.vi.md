**[🇬🇧 English](README.md) · [🇻🇳 Tiếng Việt](README.vi.md) · [🇨🇳 中文](README.zh.md)**

<div align="center">

<img src="docs/images/banner.png" alt="Biểu tượng ví VíGiaĐình được bảo vệ" width="1200">

# VíGiaĐình

**Ví thông minh Stellar không cần seed phrase — chính gia đình là cơ chế khôi phục của bạn.**

*Ví khác đưa bạn mười hai từ để rồi có thể làm mất. Ví này trao cho bạn gia đình.*

Stellar APAC Hackathon 2026

![hợp đồng đã xác minh](https://img.shields.io/badge/contracts-5%2F5%20verified-1a7f37)
![kiểm thử](https://img.shields.io/badge/tests-600%2B%20passing-1a7f37)
![hạn mức trên chuỗi](https://img.shields.io/badge/spending%20limits-enforced%20on--chain-f26522)
![không seed phrase](https://img.shields.io/badge/seed%20phrase-none-15324a)
![mạng](https://img.shields.io/badge/network-Stellar%20Testnet-15324a)
![khôi phục](https://img.shields.io/badge/recovery-3%20guardians%20%C2%B7%2024h%20timelock-15324a)

**[🌐 Trang giới thiệu](https://familyhavenwallet.mscilabs.com/)** · **[↗ Ứng dụng thật](https://familyhaven.mscilabs.com)** · **[▶ Trailer](https://www.youtube.com/watch?v=K5jz1tClGng)** · **[⚡ Bắt đầu nhanh](#bắt-đầu-nhanh)**

<img src="docs/images/welcome-judges.png" alt="Cánh cửa hình học mở dưới ba ngôi sao bảo vệ" width="900">

Kính chào ban giám khảo Stellar — các liên kết phía trên dẫn tới câu chuyện dự án, ứng dụng Testnet thật và trailer sản phẩm dài hai phút.

</div>

## Chấm trong 60 giây

| | |
|---|---|
| **Vấn đề** | Seed phrase biến việc khôi phục ví thành chuyện giữ một bí mật duy nhất và rất dễ mất. Mất thì có thể bị khóa khỏi ví; chia sẻ thì có thể mất cả ví. |
| **Giải pháp** | Tài khoản thông minh Stellar dùng passkey, giữ khóa ký trong Secure Enclave hoặc TPM của thiết bị. Từ ba người thân do chủ ví chọn tạo thành đường khôi phục theo ngưỡng, có thời gian chờ 24 giờ và quyền phủ quyết của chủ ví. |
| **Kết quả** | Chủ ví có thể dùng và khôi phục ví thông minh thật trên Testnet mà không phải lưu hay gõ mười hai từ. Một tiến trình đọc chuỗi khối trực tiếp có thể cảnh báo bên ngoài ứng dụng khi có yêu cầu khôi phục. |
| **Kiểm soát** | Số người bảo hộ tối thiểu, ngưỡng đồng ý, thời gian chờ, cooldown sau xoay khóa và trần chi tiêu đều được cưỡng chế trên chuỗi. Bản dựng lại công khai của hợp đồng được StellarExpert đối chiếu độc lập. |

## Bản demo 2 phút

1. Mở [ứng dụng thật](https://familyhaven.mscilabs.com), tạo tài khoản và đăng ký passkey của thiết bị. Hệ thống không sinh seed phrase.
2. Thêm người thân làm người bảo hộ. Trang nhận lời mời giải thích vai trò và rủi ro trước khi đăng nhập; khả năng khôi phục chỉ hoạt động khi có ít nhất ba khóa người bảo hộ trên chuỗi.
3. Gửi XLM trên Stellar Testnet. Giao dịch hằng ngày theo hạn mức mềm do người dùng đặt; hợp đồng chính sách đo tổng chi và cưỡng chế trần cứng.
4. Bắt đầu khôi phục từ thiết bị khác. Người bảo hộ đồng ý, cửa sổ phủ quyết 24 giờ vẫn hiển thị, còn tiến trình theo dõi độc lập có thể gửi email ngay cả khi bộ đánh chỉ mục của ứng dụng ngừng hoạt động.
5. Khi hoàn tất, hợp đồng xoay khóa ký của tài khoản thông minh. Khóa cũ ngừng hoạt động và cooldown 300 giây chặn cuộc đua giao dịch ngay sau khi đổi khóa.

Mã nguồn này **không có chế độ demo dựng sẵn**. Các luồng sản phẩm dùng hợp đồng và giao dịch thật trên Stellar Testnet.

## Vì sao khác biệt về kỹ thuật

| Năng lực | Ngăn được điều gì |
|---|---|
| Không seed phrase — passkey trong Secure Enclave hoặc TPM | Mất giấy hoặc bị lừa nhập mười hai từ vào trang giả |
| Giới hạn khôi phục tối thiểu được cưỡng chế **trong hợp đồng** | Kẻ chiếm máy chủ hạ cấu hình xuống một người bảo hộ hoặc không còn thời gian chờ |
| **Hai đường cảnh báo độc lập** — một tiến trình đọc hợp đồng trực tiếp và gửi email ngoài ứng dụng | Làm chủ ví im lặng bằng cách chỉ vô hiệu hóa bộ đánh chỉ mục trong 24 giờ |
| Thời gian chờ 24 giờ và quyền phủ quyết on-chain của chủ ví | Người bảo hộ thông đồng chiếm ví ngay lập tức |
| Hạn mức chi tiêu là **hợp đồng chính sách** gắn vào quy tắc ủy quyền OpenZeppelin | Máy chủ bị chiếm rút cạn ví |
| Nâng hạn mức phải chờ 24 giờ | Kẻ chiếm tài khoản nâng trần rồi rút ngay |
| Không có “người bảo hộ của nhà phát hành” | Nhà phát hành tự khôi phục ví của người dùng |
| Cooldown 300 giây sau khi xoay khóa | Chạy đua giao dịch ngay sau lúc đổi khóa |
| Nhật ký chỉ-ghi-thêm, thu hồi quyền ở cấp role | Quản trị viên xóa dấu vết |
| Trang nhận lời mời giải thích vai trò **trước khi đăng nhập** | Chính sản phẩm dạy người dùng thói quen dễ bị lừa |

### Ràng buộc khôi phục trên chuỗi

Các ràng buộc này từng chỉ được kiểm tra ở máy chủ. Sau một vòng tự rà soát, chúng được chuyển xuống hợp đồng để người chiếm máy chủ không thể hạ thấp:

| Bất biến | Giá trị cưỡng chế | Kết quả từ hợp đồng |
|---|---:|---|
| `MIN_GUARDIANS` | `3` | panic `#4` khi vi phạm |
| `MIN_THRESHOLD` | `2` | panic `#3` khi vi phạm |
| `MIN_TIMELOCK_SECS` | `86.400` | panic `#17` khi vi phạm |
| Cooldown sau xoay khóa | `300s` | mã `#101` khi còn hiệu lực |

### Chính sách chi tiêu

| Lớp kiểm soát | Mặc định hiển thị trong sản phẩm | Cách thay đổi |
|---|---:|---|
| Mỗi giao dịch, mềm và do người dùng đặt | `1.000 XLM` | Hạ ngưỡng có hiệu lực ngay |
| Cửa sổ 24 giờ, mềm và do người dùng đặt | `10.000 XLM` | Nâng ngưỡng phải chờ 24 giờ, gửi email cho chủ ví và có thể hủy |
| Trần cứng trên chuỗi | `20.000 XLM` | Máy chủ không thể vượt qua |

## Kiến trúc

<img src="docs/images/architecture.png" alt="Kiến trúc bốn lớp của VíGiaĐình: thiết bị, giao diện, điều phối và hợp đồng trên chuỗi" width="1200">

```text
Người thân (trình duyệt, không cần cài ứng dụng)
      │
 Passkey ── Secure Enclave / TPM · khóa không rời thiết bị
      │
 Phiên ví SEP-45 ── tách biệt với phiên đăng nhập ứng dụng
      │
┌──────────────────────── NGUỒN SỰ THẬT TRÊN CHUỖI ───────────────────────────────┐
│  smart-account (OZ stellar-accounts)                                             │
│    __check_auth ── cooldown xoay khóa → quy tắc ngữ cảnh → policy.enforce()       │
│         ├── rule 0 (mặc định) + spending-limit policy                            │
│         └── rule 1 (chủ ví)   + spending-limit policy                            │
│  recovery-registry ── MIN_GUARDIANS 3 · THRESHOLD 2 · TIMELOCK 24h · phủ quyết   │
│  origin-verifier ── danh sách origin passkey được ghim khi triển khai             │
└──────────────────────────────────────────────────────────────────────────────────┘
      │                                        │
 Bộ đánh chỉ mục (bản sao Postgres)  recovery-watch ── đọc chuỗi TRỰC TIẾP
      │                                        │
 Cảnh báo trong ứng dụng              Email BÊN NGOÀI ứng dụng
                                      (vẫn chạy khi hệ thống của chúng tôi lỗi)
```

### Ngăn xếp kỹ thuật

| Lớp | Thành phần |
|---|---|
| Hợp đồng | Rust · Soroban SDK 26.1.1 · OpenZeppelin `stellar-accounts =0.7.2` · `wasm32v1-none` · stellar-cli 27.0.0 · rustc 1.97.1 |
| Backend | Bun · Hono 4.12 · Drizzle · PostgreSQL · Dragonfly · BullMQ · Better Auth 1.6 |
| Frontend | React 19 · Vite · TanStack Router/Query · ba ngôn ngữ (`vi`, `en`, `zh`) |
| Triển khai | Docker Compose với ba cổng kiểm tra trước khi phát hành và cập nhật không gián đoạn · Cloudflare Pages |
| Xác thực | WebAuthn passkey · phiên ví SEP-45 · không có seed phrase ở bất kỳ đâu trong mã nguồn |

## Bằng chứng, không lời hứa

### Xác minh hợp đồng công khai

StellarExpert hiện trả về `validation.status = verified` cho cả năm hợp đồng đã triển khai:

| Hợp đồng | ID Stellar Testnet | Trạng thái | Mã nguồn đã xác minh |
|---|---|---|---|
| `recovery-registry` | [`CDGB…4JIR`](https://stellar.expert/explorer/testnet/contract/CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `origin-verifier` | [`CBFC…VVGW`](https://stellar.expert/explorer/testnet/contract/CBFCNHIOQN3N5IVSIVW4TTKYXZ73YQI4DZPADC6UCWF2XU35W4GVVWGW) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `web-auth` (SEP-45) | [`CBWM…JBWD`](https://stellar.expert/explorer/testnet/contract/CBWMHVEEXEOSOSWULYNYN62EYVMWJT55NKRPUI2MXSYHVVZ6NIMRJBWD) | **verified** | [`da689235`](https://github.com/msci2049-hkt/vigiadinh/commit/da6892353e8b2076508e866efe9e1d13a7264ed4) |
| `verifier-ed25519` | [`CC7L…VDEE`](https://stellar.expert/explorer/testnet/contract/CC7L7IGJ7ZBUQCYUTV6J6KLKMKYKAZIV5FMRISPNIZZW63664TWOVDEE) | **verified** | [`96957faa`](https://github.com/msci2049-hkt/vigiadinh/commit/96957faa46230744a56f90655b7994ff045c4844) |
| `spending-limit-policy` | [`CCIN…FJZK`](https://stellar.expert/explorer/testnet/contract/CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK) | **verified** | [`96957faa`](https://github.com/msci2049-hkt/vigiadinh/commit/96957faa46230744a56f90655b7994ff045c4844) |

Dấu xác minh nghĩa là bản dựng lại từ mã nguồn công khai được liên kết khớp mã băm on-chain. Đây **không phải** kiểm định an ninh độc lập.

| Định danh triển khai bổ sung | Giá trị |
|---|---|
| Mạng | **Stellar Testnet** |
| Smart-account WASM | `c1b28d42da1b7b091307c9acb0d72b88f45cc29d404b4d3c30bca0250a9d565f` |
| SAC native cố định | [`CDLZ…CYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

### Cổng kiểm tra và bằng chứng giao dịch có thể chạy lại

| Cổng chất lượng | Kết quả |
|---|---|
| Hợp đồng verified công khai | **5/5** — ba hợp đồng từ `da689235`, hai hợp đồng từ `96957faa` |
| Kiểm thử hợp đồng Rust | **82 pass** |
| Kiểm thử backend, lần chạy đầy đủ hiện tại trên Windows | **457 pass**, 22 ca bỏ qua do cần môi trường; một test lưu trữ Bash lỗi vì đường dẫn tạm đi qua ranh giới Windows/Bash |
| Kiểm thử frontend | **209 pass** |
| Hạn mức on-chain — dưới ngưỡng | Pass **và được ghi nhận vào tổng đã chi** |
| Hạn mức on-chain — vượt trong một giao dịch | Bị chối với `#3221` |
| Hạn mức on-chain — nhiều giao dịch cộng dồn vượt ngưỡng | Bị chối |
| Hạn mức on-chain — qua cửa sổ trượt | Pass trở lại |
| Xoay ví đầy **15 khóa** | Thành công, có bằng chứng ledger |
| Cooldown 300 giây | Chặn trong cửa sổ và mở đúng tại biên |
| Thiếu người bảo hộ | Bị chối với `#4` |
| Cảnh báo khôi phục đọc chuỗi trực tiếp | Email được gửi ngoài ứng dụng với `status=sent` |
| Cổng chặn placeholder i18n chưa thay | Có; bắt được lỗi từng lọt qua hai lần |
| Nhật ký chỉ-ghi-thêm | Hai lớp: trigger PostgreSQL và thu hồi quyền ở cấp role |

Badge ghi “600+ passing” vì các bộ kiểm thử mới nhất có **748 test pass** ở hợp đồng, backend và frontend. Ca Testnet hoặc Dragonfly cần môi trường riêng được báo là skip, không tính giả thành pass.

## Bắt đầu nhanh

```bash
git clone https://github.com/msci2049-hkt/vigiadinh.git
cd vigiadinh

# Hợp đồng
cd contracts && cargo test --workspace && stellar contract build

# Backend (:3000)
cd ../be && cp .env.example .env
# Điền DATABASE_URL, REDIS_URL, RESEND_API_KEY và các contract ID.
bun install && bun run validate && bun test

# Frontend (:5173)
cd ../fe && pnpm install && pnpm validate && pnpm test && pnpm dev
```

Cây mã nguồn này **không có chế độ demo dựng sẵn**. Các luồng khi chạy làm việc với Stellar Testnet.

## Truy cập bản demo

| | |
|---|---|
| Trang giới thiệu | [familyhavenwallet.mscilabs.com](https://familyhavenwallet.mscilabs.com/) |
| Ứng dụng thật | [familyhaven.mscilabs.com](https://familyhaven.mscilabs.com) |
| Mạng | **Stellar Testnet** |
| Chế độ demo | Không có — dùng tài khoản Testnet và luồng Testnet thật |

## Bản đồ mã nguồn

```text
contracts/          recovery-registry · origin-verifier · web-auth · verifier-ed25519
                    smart-account · spending-limit-policy
be/                 modules: guardians · recovery · intents · notifications · inheritance
                    jobs: recovery-watch · indexer · presence · heartbeat · sweeper
fe/apps/web/        wallet · guardians · protecting · setup wizard · settings
docs/               VERIFY-CONTRACT.md · AUDIT-TINH-NANG.md · evidence/TESTNET.md
                    INHERITANCE.md · SEND-ADDRESSES.md · THREAT-MODEL.md
```

## Liên kết bài dự thi

| | |
|---|---|
| 🌐 Trang dự án | [VíGiaĐình](https://familyhavenwallet.mscilabs.com/) |
| ↗ Ứng dụng thật | [Mở ứng dụng Testnet](https://familyhaven.mscilabs.com) |
| ▶ Trailer | [Family Haven 4K Introduction](https://www.youtube.com/watch?v=K5jz1tClGng) |
| ⌘ Mã nguồn | [github.com/msci2049-hkt/vigiadinh](https://github.com/msci2049-hkt/vigiadinh) |
| ✉ Liên hệ | [MSCI Labs](https://www.mscilabs.com) |

## Giới hạn đã biết

| Giới hạn | Trạng thái |
|---|---|
| Phiếu đồng ý của người bảo hộ là bản ghi cơ sở dữ liệu, **chưa phải chữ ký on-chain** | Máy chủ bị chiếm có thể giả phiếu. Đã tự phát hiện; đang sửa |
| Passkey gắn với tên miền | Mất tên miền sẽ mất đường ký hiện tại. Hướng dẫn ký khôi phục bằng CLI đang được viết |
| **Chưa có kiểm định an ninh độc lập** | Điều kiện bắt buộc trước khi lên mạng chính |
| Giao diện chỉ hiển thị và chi XLM | Ví có thể nhận mọi tài sản Stellar ở cấp giao thức; vẫn cần bộ lọc token rác |
| Luồng chăm sóc khi nằm viện và chia thừa kế theo phần trăm | Thuộc lộ trình; chưa được triển khai |
| Chỉ Testnet | Chủ ý của bản mẫu; xem ghi chú phạm vi |

## Đội ngũ

**[MSCI Labs](https://www.mscilabs.com)** — Vietnam · Singapore · Thailand · India

---

> **Phạm vi.** Bản mẫu hackathon chạy trên Stellar Testnet. Không dùng tiền thật. Các ngưỡng chính sách chỉ có tính minh họa và người dùng có thể cấu hình. Xác minh hợp đồng chỉ xác nhận mã nguồn đã công bố khớp bytecode on-chain — không phải kiểm định an ninh độc lập. Đây không phải lời khuyên tài chính.
