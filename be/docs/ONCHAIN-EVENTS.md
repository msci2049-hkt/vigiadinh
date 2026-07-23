# ONCHAIN-EVENTS — tên event + payload THẬT của contract (nguồn cho M2 indexer)

> **Vì sao file này tồn tại (T4):** indexer M2 lọc `getEvents` theo `contract_id` + **topic symbol**.
> Sai tên topic một ký tự → indexer câm, không mirror được gì. File này là **hợp đồng sự thật**
> giữa contract và BE — đọc từ code contract, KHÔNG đoán theo checklist.
>
> Nguồn: `vigiadinh-main/contracts/recovery-registry/src/lib.rs` — repo cũ NGOÀI monorepo này
> (đọc 2026-07-20). Sau M0, contract sống ở `contracts/` của monorepo `family-wallet` và file này
> phải regenerate từ `contracts/recovery-registry/src/lib.rs` mới.
> Contract testnet đã deploy: `CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V`
> (theo `docs/PROJECT-BRIEF.md §4`).

## ⚠️ CẢNH BÁO PHỤ THUỘC — đọc trước khi build M2

Tên event dưới đây là của contract **HIỆN TẠI (trước M0)**. Milestone **M0 sẽ VIẾT LẠI +
MỞ RỘNG** contract (thêm `expires_at`, `guardian_cancel`, contract `inheritance`, "event đầy đủ
cho indexer"). Khi đó tên/topic/payload **sẽ đổi**.

**Luật:** M2 (indexer) nằm SAU M0 trên đường găng. Sau khi M0 deploy contract mới lên testnet,
**PHẢI regenerate file này từ `lib.rs` mới + verify bằng 1 `getEvents` thật** rồi mới code map
event → notify. Đừng hard-code tên event M2 theo bảng checklist (`recovery_initiated`, …) —
checklist dùng tên khái niệm, **contract dùng `symbol_short!` ≤ 9 ký tự** (xem cột "topic thật").

## Ràng buộc Soroban cần nhớ

- `symbol_short!` giới hạn **9 ký tự** `[a-zA-Z0-9_]`. Mọi tên event là symbol ngắn, KHÔNG phải
  chuỗi dài như `recovery_initiated`.
- Mỗi event = **(topics tuple, data)**. Topic[0] = symbol tên event; topic[1] = địa chỉ ví/owner
  (indexable). `data` = payload còn lại. Indexer lọc theo topic[0] (+ optionally topic[1]).
- RPC `getEvents` chỉ giữ ~7 ngày (rule `stellar.md`) → checkpoint bắt buộc (xem skill `fw-indexer-notify`).

## Bảng event THẬT (contract hiện tại — recovery-registry)

| # | Tên khái niệm (checklist M2) | topic[0] symbol THẬT | topic[1] | data payload | Hàm phát |
|---|---|---|---|---|---|
| 1 | (đăng ký ví) | `register` | `owner: Address` | `threshold: u32` | `register_wallet` |
| 2 | (thêm guardian) | `g_add` | `wallet: Address` | `new_guardian: Address` | `add_guardian` |
| 3 | (xoá guardian) | `g_remove` | `wallet: Address` | `guardian: Address` | `remove_guardian` |
| 4 | `recovery_initiated` | `initiate` | `wallet: Address` | `new_owner_candidate: Address` | `initiate_recovery` |
| 5 | `recovery_approved` | `approve` | `wallet: Address` | `(guardian: Address, approvals_len: u32)` | `approve_recovery` |
| 6 | `recovery_cancelled` | `cancel` | `wallet: Address` | `owner: Address` | `cancel_recovery` (veto) |
| 7 | `recovery_finalized` | `finalize` | `wallet: Address` | `new_owner: Address` | `finalize_recovery` |

Ghi chú map cho M2 (khi contract chưa đổi):
- `initiate` → risk engine + notify guardian (score) + notify MỌI thiết bị owner có nút VETO.
- `approve` → SSE tiến độ (payload có `approvals_len` = số phiếu hiện tại, tiện đếm ngưỡng).
- `finalize` → thông báo hoàn tất.
- `cancel` → nhắc guardian cảnh giác (veto đã kích hoạt).

## Event M2 checklist đề cập nhưng contract HIỆN TẠI CHƯA phát (sẽ có ở M0)

| Tên khái niệm | Trạng thái | Ghi chú |
|---|---|---|
| `heartbeat` | CHƯA có | Cần contract `inheritance` (M0). Symbol dự kiến `heartbeat` (đúng 9 ký tự). |
| `inheritance_*` (`set_heirs`/`open`/`approve`/`cancel`/`finalize`) | CHƯA có | Cần contract `inheritance` (M0). Symbol dự kiến `inh_open`,`inh_appr`,`inh_final`,`inh_cancel`,`set_heirs`. |
| `will_hash_anchored` | **BỎ QUA vĩnh viễn** | Tính năng két di chúc ĐÃ HỦY (PROJECT-BRIEF §4). Indexer KHÔNG map. |
| `expires_at` cleanup / `guardian_cancel` | CHƯA có | M0 thêm. Symbol dự kiến `expire`, `g_cancel`. |

## Việc phải làm ở M0 (nhắc lại, để không quên đồng bộ)

1. Đặt tên symbol ≤ 9 ký tự cho mọi event mới, cập nhật bảng trên.
2. Sau deploy testnet: chạy `stellar events`/`getEvents` thật, dán 1 mẫu topic thô vào đây làm bằng chứng.
3. Đối chiếu `src/shared-contract/` (BE là nguồn) nếu FE cần enum trạng thái.
