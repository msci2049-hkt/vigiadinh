# Thừa kế — tài liệu cho NGƯỜI THỪA KẾ và người giữ hồ sơ

> Viết cho tình huống thật: nhiều tháng, có khi nhiều năm sau, một người trong
> gia đình cần mở lại ví này. Có thể lúc đó công ty làm ra ứng dụng không còn
> tồn tại. Tài liệu này nói rõ điều gì vẫn chạy trong trường hợp đó.
> Cập nhật 2026-07-25.

## 1. Điều quan trọng nhất: ví KHÔNG phụ thuộc vào công ty

Tiền và quyền mở ví nằm trên **chuỗi Stellar**, không nằm trong máy chủ của
ứng dụng. Backend sập, tên miền hết hạn, công ty giải thể — ví vẫn ở đó, và
người bảo hộ vẫn mở được nó bằng đúng quy trình khôi phục đã cài sẵn.

Cái mất đi khi không còn ứng dụng là **sự tiện lợi**: giao diện, thông báo,
nhắc nhở. Không phải quyền sở hữu.

## 2. Ví "nằm im nhiều năm" có mất không?

**Không.** Đây là câu hỏi đúng và câu trả lời cần chính xác, vì trong Soroban
mọi dữ liệu hợp đồng đều có hạn sống (TTL) và bị **lưu trữ (archive)** khi hết
hạn — nghe như "biến mất".

Từ **Protocol 23** (CAP-0066), dữ liệu bị archive được **tự động khôi phục**
khi nó xuất hiện trong footprint của một `InvokeHostFunctionOp`; danh sách cần
khôi phục thường do **simulation qua RPC tự điền**. Nghĩa là người thừa kế
nhiều năm sau **cứ gọi hợp đồng như bình thường** — dữ liệu sống lại trong
chính giao dịch đó, chỉ tốn thêm phí khôi phục.

`RestoreFootprintOp` thủ công **phần lớn không còn cần thiết**. Nó còn dùng cho
vài trường hợp hiếm: khi tự-động-khôi-phục làm giao dịch vượt giới hạn kích
thước của mạng, hoặc khi bên phát triển muốn tự trả phí khôi phục thay vì để
người dùng trả.

### Vậy cron `ttl-keeper` của ứng dụng để làm gì?

**Để tối ưu phí, không phải để giữ ví sống.** Job `be/src/jobs/ttl-keeper.ts`
gia hạn TTL định kỳ nên dữ liệu hiếm khi rơi vào trạng thái archive, và người
dùng không gặp một khoản phí khôi phục bất ngờ.

> ⚠️ **Không được viết ở bất cứ đâu rằng "cron chết thì mất ví".** Điều đó sai
> và làm người đọc sợ nhầm chỗ. Cron chết = có thể tốn thêm phí khôi phục vào
> lần dùng tiếp theo. Ví không brick.

## 3. Người thừa kế cần gì để mở ví

Ba thứ, không cần ứng dụng:

1. **Địa chỉ ví** (dạng `C…`) — ghi ở mục 6 bên dưới.
2. **Đủ số người bảo hộ** theo ngưỡng đã cài (mặc định 2). Mỗi người mở bằng
   khoá trên máy của chính họ.
3. **Địa chỉ hợp đồng registry khôi phục** — ghi ở mục 6.

Quy trình on-chain (không qua ứng dụng): một người bảo hộ gọi
`initiate_recovery` với khoá mới, những người còn lại gọi `approve_recovery`,
chờ hết thời gian chờ đã cài, rồi bất kỳ ai gọi `finalize_recovery`. Sau đó ví
nhận khoá mới; **địa chỉ ví không đổi và tiền không di chuyển**.

Sau khi khôi phục có **cửa sổ bảo vệ** (mặc định 24 giờ) — ví từ chối mọi chữ
ký trong khoảng này. Đó là hành vi đúng, không phải hỏng: nó chặn kẻ vừa chiếm
được đợt khôi phục rút tiền ngay.

## 4. Người bảo hộ đại diện bằng gì

Bằng **hợp đồng ví của chính họ** (`C…`), không phải bằng khoá thô. Lý do kỹ
thuật: registry cần người bỏ phiếu tự chứng thực được (`require_auth`), mà chỉ
địa chỉ mới làm được điều đó.

Hệ quả thực tế đáng nói với gia đình: **người bảo hộ không cầm tiền của bạn và
không tiêu được nó.** Họ chỉ tham gia được vào đúng một việc — mở lại ví — và
việc đó còn phải qua thời gian chờ để bạn kịp chặn nếu không phải bạn yêu cầu.

## 5. Nếu ứng dụng không còn tồn tại

Mọi thứ ở mục 3 làm được bằng công cụ chuẩn của Stellar:

```bash
# Đọc cấu hình khôi phục của ví (ai là người bảo hộ, cần bao nhiêu người)
stellar contract invoke --id <REGISTRY> --network mainnet \
  -- get_wallet_config --wallet <ĐỊA-CHỈ-VÍ>

# Mở khôi phục (một người bảo hộ ký)
stellar contract invoke --id <REGISTRY> --source <ví-người-bảo-hộ> --network mainnet \
  -- initiate_recovery --wallet <ĐỊA-CHỈ-VÍ> --new_signer <...> --initiator <...>
```

Mã nguồn hợp đồng nằm trong `contracts/` của kho mã này — giữ một bản sao kho
mã cùng với tài liệu này.

## 6. Điền trước khi cần đến (người giữ hồ sơ điền)

| Mục | Giá trị |
|---|---|
| Địa chỉ ví (`C…`) | _(điền)_ |
| Registry khôi phục | _(điền — testnet hiện tại: `CAFU4CZNPN5YWFV3QOCA4Y6FSJUB7IGI456MIGTQRJXA4DQLWUIHFMCO`)_ |
| Số người bảo hộ cần | _(mặc định 2)_ |
| Thời gian chờ | _(mặc định 24 giờ)_ |
| Người bảo hộ 1 — tên · địa chỉ `C…` | _(điền)_ |
| Người bảo hộ 2 — tên · địa chỉ `C…` | _(điền)_ |
| Người bảo hộ 3 — tên · địa chỉ `C…` | _(điền)_ |

In tài liệu này ra giấy và cất cùng giấy tờ quan trọng. **Không** ghi khoá bí
mật vào đây — không có khoá bí mật nào cần ghi: mỗi người bảo hộ giữ khoá của
họ trên máy của họ.

## 7. Chưa kiểm chứng — nói thẳng

- Auto-restore từ Protocol 23 ở đây dựa trên tài liệu giao thức (nguồn dưới),
  **chưa tự chạy thử trên ví đã archive thật** — muốn thử cần chờ TTL hết hạn
  thật hoặc mạng test có TTL rút ngắn. Ghi lại tx hash khi thử được.
- Toàn bộ luồng khôi phục đã chạy thật trên testnet (`docs/evidence/TESTNET.md`),
  nhưng **chưa chạy trên mainnet** — mainnet còn chờ tên miền + khoá.

## Nguồn

- [CAP-0066 — Soroban In-memory Read Resource](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md)
- [State Archival — Stellar Docs](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- [Create a restoration footprint manually — Stellar Docs](https://developers.stellar.org/docs/build/guides/archival/create-restoration-footprint-js)
