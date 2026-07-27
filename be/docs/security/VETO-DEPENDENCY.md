# Kịch bản #3 — veto có phụ thuộc CỨNG vào backend không?

> Audit 2026-07-25 §5. Phiên trước kết 🔴 nhưng chưa chỉ ra chính xác hai lời gọi.
> Đây là câu trả lời dứt khoát, kèm `file:dòng`.

## Một câu

**CÓ.** Đường veto phụ thuộc cứng vào backend, vì bước nộp cần **ví phí ký
envelope**; còn `finalize_recovery` thì **không cần backend nào cả**. Bất đối xứng
đúng chiều xấu nhất: backend sập thì kẻ tấn công vẫn đi được, người phòng thủ thì không.

## Hai lời gọi trên đường veto

| # | Endpoint | Làm gì | `file:dòng` |
|---|---|---|---|
| 1 | `POST /api/recovery/veto` | Kiểm `wallet.userId === caller` rồi **dựng** args `cancel_recovery(wallet)`, simulate, trả auth entries XDR **chưa ký** cho ví ký bằng passkey | `onchain-actions/service.ts:110-117` (nhánh `veto`), dựng ở `:146-152` |
| 2 | `POST /api/recovery/submit` | Validate whitelist contract+method → `assertSponsorshipAllowed` → `gateway.invoke(...)`: **re-simulate + VÍ PHÍ KÝ ENVELOPE + submit + poll** | `onchain-actions/service.ts:159-193`, ký/nộp ở `:180-186` |

## Lời gọi nào FE tự làm được, lời gọi nào không

- **Lời gọi 1 — FE làm được.** Chỉ là dựng args + simulate. FE nói chuyện thẳng với
  RPC công cộng là đủ. Ở đây BE chỉ **tiện hơn** (giữ `CONTRACT_ID_RECOVERY`, chuẩn
  hoá args), **không bắt buộc**.
- **Lời gọi 2 — FE KHÔNG làm được như hiện tại.** Ví là smart account (`C…`), nó
  **không có XLM để trả phí**; toàn bộ mô hình là fee sponsorship, envelope do ví phí
  của server ký. Không có backend thì không ai trả phí cho tx veto.

Vậy điểm phụ thuộc cứng **không phải chữ ký của người dùng** (passkey ký entry ngay
trên máy), mà là **chữ ký trả phí**.

## Vì sao đây là bất đối xứng, không chỉ là "một tính năng cần server"

`finalize_recovery` **không đòi auth người dùng** — contract tự cưỡng chế timelock +
threshold, interface không có arg actor (`onchain-actions/service.ts:196-206`). Nghĩa
là bất kỳ ai cũng nộp thẳng lên RPC công cộng và **tự trả phí bằng tài khoản classic
của mình**. Kẻ tấn công đã chờ hết timelock thì phí vài stroop không phải rào cản.

Đặt cạnh nhau:

| | Cần backend? | Cần ví phí? |
|---|---|---|
| Tấn công (`finalize_recovery` sau timelock) | **Không** | Không — tự trả |
| Phòng thủ (`cancel_recovery` = veto) | **Có** | **Có** |

Backend sập trong cửa sổ timelock ⇒ mất phòng tuyến người phòng thủ, giữ nguyên
đường tấn công. Đây là vi phạm bất biến 1 ("backend sập không ai mất tiền") ở dạng
tinh vi: không mất tiền vì backend bị chiếm, mà vì backend **vắng mặt**.

## Cần gì để gỡ — quyết định thiết kế, không phải bug để vá lặng lẽ

Phải có **đường veto không cần fee-bump**: chủ ví tự trả phí XLM từ một tài khoản
classic `G…` của chính họ.

- **Phần BE (làm được, chưa làm ở phiên này):** thêm đường trả về envelope veto
  **chưa ký phí** để client tự nộp — về bản chất là tách `build` khỏi `invoke` ở
  `submitRecoveryAction`. Kèm tài liệu chỉ rõ contract id + method + args để FE dựng
  lại được **mà không cần BE** khi BE chết.
- **Phần FE (KHÔNG tự sửa ở phiên này — luật §0.1):** màn "veto khẩn cấp" dựng tx
  thẳng với RPC công cộng, cho phép dán/nối một tài khoản `G…` có XLM để trả phí.
- **Phần vận hành:** ví phí là **điểm chết đơn** (single point of failure) của toàn
  bộ khả năng phòng thủ. Ví phí cạn XLM có hậu quả **giống hệt** backend sập. Phải
  có cảnh báo số dư ví phí, và con số đó phải nằm trong runbook mainnet.

## Điều kiện mainnet

Không lên mainnet khi chưa có ít nhất MỘT đường veto chạy được với backend tắt hẳn,
và đường đó phải được **diễn tập thật** (tắt BE, thực hiện veto thành công, ghi tx
hash), không phải chỉ tồn tại trong code.
