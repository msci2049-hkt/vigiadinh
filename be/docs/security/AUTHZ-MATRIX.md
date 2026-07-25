# Ma trận authz (BOLA) — audit 2026-07-25 §3

Nguồn kiểm: `src/modules/authz-matrix.integration.test.ts` (30 ca, chạy trong CI).
Bảng này là **bản đồ**; test mới là bằng chứng. Sửa route mà không sửa cả hai = trôi.

## Vì sao cần

BOLA chiếm ~40% tấn công API và đứng số 1 OWASP API Top 10. Điểm cốt tử: **không
phát hiện được bằng test tĩnh hay quét động tự động**. 285 ca xanh trước phiên này
đều chạy dưới MỘT danh tính — chúng chứng minh "chủ ví đọc được ví mình", không ca
nào hỏi "người lạ có đọc được không". Cách kiểm duy nhất đáng tin: **hai tài khoản
hợp lệ, verify mỗi bên không chạm được object của bên kia.**

## Con số

| | |
|---|---|
| Route đã mount | **45** |
| Route nhận ID object (walletId/guardianId/intentId/inviteId/token/address) | **26** |
| Có kiểm ownership dựa DB | **21** |
| Public CÓ CHỦ ĐÍCH, không có ownership | **5** |
| **FAIL test hai tài khoản** | **0** |
| Lấy vai trò từ claim client thay vì DB | **0** |

Không route nào rò dữ liệu chéo tài khoản. Ba lần chạy độc lập, cùng kết quả.

## Hai hình dạng phòng thủ — cả hai hợp lệ

Bản đầu của test đòi "gọi ID người khác thì KHÔNG được 200" và làm 6 route đỏ. Đo
lại thì cả 6 trả `{"data":[]}` cho người lạ trong khi chủ ví nhận đúng dòng của
mình. Tức phòng thủ **có chạy**, chỉ khác hình dạng:

- **(a) 4xx** — chối thẳng. `GET /api/wallets/:id`, `chain-truth`, mọi route ghi.
- **(b) 200 rỗng** — repo scope theo owner (`WHERE ... AND wallets.user_id = $me`),
  không khớp dòng nào. Kín hơn (b) không xác nhận object tồn tại), nhưng khó soi hơn.

Bất biến được test giữ: **người lạ không nhận DỮ LIỆU**. Siết thành "cấm 200" là báo
động giả, và báo động giả thì phiên sau tắt test chứ không sửa code.

## Chứng minh ngược (bắt buộc)

Không có nó thì cả ma trận vô giá trị: fixture chết cũng cho `{"data":[]}` và mọi ca
xanh vì **không có gì để rò**. Test có 2 ca gọi CÙNG URL, CÙNG ID, chỉ đổi danh tính
sang chủ sở hữu → phải trả ra dòng thật.

Kiểm lại lần nữa bằng cách gỡ vế owner khỏi `guardians.repository.ts:19`:

```
BOLA: GET /api/guardians/wallet/:walletId trả 200 KÈM DỮ LIỆU của người khác:
{"data":[{"id":"01KYCWWCDD…","walletId":"01KYCWWCCD…","userId":"2zwCrutl…"}]}
29 pass, 1 fail
```

## Bảng route nhận ID

`file:dòng` = nơi vế owner nằm trong SQL, hoặc nơi so sánh trong handler.

| Method + path | Ownership check | Hình dạng |
|---|---|---|
| `GET /api/wallets/:id` | `wallets.repository.ts:19-26` | 4xx |
| `PATCH /api/wallets/:id/recovery-config` | `wallets.repository.ts:19-26` | 4xx |
| `GET /api/guardians/wallet/:walletId` | `guardians.repository.ts:19` | 200 rỗng |
| `POST /api/guardians/invites` | `invites.repository.ts:13` | 4xx |
| `GET /api/guardians/invites/wallet/:walletId` | `invites.repository.ts:13` | 200 rỗng |
| `POST /api/guardians/invites/registered` | `invites.repository.ts:13` | 4xx |
| `GET /api/presence/guardian/:guardianId` | `presence.repository.ts:20` | 200 rỗng |
| `GET /api/recovery/wallet/:walletId` | `recovery.repository.ts:257` | 200 rỗng |
| `GET /api/recovery/chain-truth/:walletId` | `chain-truth/handler.ts:62` | 4xx |
| `POST /api/recovery/register` | `onchain-actions/service.ts:119` | 4xx |
| `POST /api/recovery/initiate` | `recovery.repository.ts:29` (guardian) | 4xx |
| `POST /api/recovery/approve` | `recovery.repository.ts:29` (guardian) | 4xx |
| `POST /api/recovery/veto` | `onchain-actions/service.ts:112` (owner) | 4xx |
| `POST /api/recovery/addGuardian` | `onchain-actions/service.ts:134` | 4xx |
| `POST /api/recovery/submit` | `service.ts:60-69` — **owner HOẶC guardian** | 4xx |
| `POST /api/recovery/finalize` | `service.ts:60-69` — **owner HOẶC guardian** | 4xx |
| `GET /api/inheritance/wallet/:walletId` | `inheritance.repository.ts:38` | 200 rỗng |
| `GET /api/inheritance/wallet/:walletId/plan` | `inheritance.repository.ts:22` | 200 rỗng |
| `POST /api/inheritance/heartbeat` | `heartbeat.repository.ts:105-109` | 4xx |
| `GET /api/audit/wallet/:walletId` | `indexer.repository.ts:17` | 200 rỗng |
| `POST /api/intents` | `intents.repository.ts:37` | 4xx |
| `POST /api/intents/send/prepare` | `send-flow/service.ts:54` | 4xx |
| `POST /api/intents/send/confirm` | `send-flow/service.ts:54` | 4xx |
| `GET /api/intents/send/:intentId/signable` | `send-flow/service.ts:54` | 4xx |
| `POST /api/intents/send/sign` | `send-flow/service.ts:54` | 4xx |
| `POST /api/intents/send/guardian-approve` | `intents.repository.ts:194` (guardian) | 4xx |

## Public có chủ đích — KHÔNG có ownership (5)

Mỗi dòng là quyết định thiết kế, không phải sót:

1. `GET /api/sep45/challenge` · `POST /api/sep45/token` — **đây là cửa đăng nhập**,
   chưa có phiên nào trước đó. Đổi lại: rate-limit `failOpen:false` + nonce
   single-use + verify chữ ký on-chain + (từ phiên này) cổng footprint.
2. `GET /api/guardians/invites/:token` — sở hữu token 32 byte LÀ quyền. Phơi ra
   `label` + `status`, không hơn.
3. `POST /api/recovery/public/device-request` — người mất thiết bị **không đăng nhập
   được**, nên cửa này buộc phải ẩn danh. Xem rủi ro còn mở ở dưới.
4. `GET /api/recovery/public/progress?address=` — trạng thái khôi phục theo địa chỉ
   công khai.

## Còn mở (KHÔNG đóng ở phiên này — ghi để không ai tưởng đã xong)

- **`POST /api/guardians/invites/:token/accept`** — `requireAuth` qua với BẤT KỲ tài
  khoản nào; không truy vấn nào buộc người gọi với lời mời. Ai có token thì thành
  guardian ví người khác. Đúng thiết kế (người được mời không phải chủ ví), nhưng
  **không có yếu tố thứ hai**: không bind email, chủ ví không xác nhận trước khi
  accept. Token 32 byte là toàn bộ phòng thủ.
- **`POST /api/recovery/submit` + `/finalize` nhận cả GUARDIAN**, không chỉ owner. Và
  `finalize` tăng `jwt_version` → một guardian đơn lẻ **ép đăng xuất mọi phiên ví**
  nếu tx on-chain thành công (`onchain-actions/service.ts:239-240`).
- **`POST /api/recovery/public/device-request` ẩn danh ghi DB + bắn thông báo**, và
  mỗi request mới đánh `superseded` request đang mở (`recovery.repository.ts:107-114`)
  — nguyên thuỷ ghi đè + spam thông báo cho bất kỳ địa chỉ C nào đoán/biết được, chỉ
  chặn bằng 5 req/phút theo IP. Xem thêm rủi ro giả mạo IP ở `RATE-LIMIT-TRUST.md`.
- **`modules/product` vẫn còn code** (`app.ts:157` không mount). List/get của nó
  không có `requireAuth` và `/:id` không có ownership — mount lại là mở 5 lỗ BOLA
  cùng lúc. Giữ nguyên trạng thái không mount.
