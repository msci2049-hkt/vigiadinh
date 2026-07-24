# COVERAGE-PRODUCT — hàm contract nào có ĐƯỜNG SẢN PHẨM gọi tới?

> Quét 2026-07-24 theo yêu cầu §3. Lớp lỗi cần bắt: **hàm đã cài + đã test on-chain
> nhưng không đường sản phẩm nào chạm tới**. Test xanh, chain xanh, người dùng vẫn
> không có tính năng — đúng thứ đã xảy ra với `set_recovery_registry` (§2).
>
> Cách quét: `grep -rn "    pub fn " contracts/*/src/lib.rs` rồi với TỪNG tên hàm
> `grep -rn "<tên>" be/src/ fe/apps/web/src/ extension/` **loại trừ** `*.test.ts` và `e2e/`.
> Loại trừ file test là điểm mấu chốt — không loại thì mọi hàm đều "có người gọi".

## Bảng đầy đủ (mọi `pub fn`, không bỏ dòng nào)

| Hàm contract | Test gọi? | Đường sản phẩm gọi? | Kết luận |
|---|---|---|---|
| **recovery-registry** ||||
| `register_wallet` | ✅ | ✅ `be/src/modules/recovery/domain/onchain.ts:18` | OK |
| `initiate_recovery` | ✅ | ✅ `onchain.ts:19` + FE `entry-fingerprint.ts:30` | OK |
| `approve_recovery` | ✅ | ✅ `onchain.ts:20` | OK |
| `cancel_recovery` | ✅ | ✅ `onchain.ts:21` (veto) | OK |
| `finalize_recovery` | ✅ | ✅ `onchain.ts:22` | OK |
| `add_guardian` | ✅ | ❌ | 🔴 **LỖ HỔNG** — không có đường thêm người bảo hộ sau khi đăng ký. Chặn wizard mức B (§4 nối) |
| `remove_guardian` | ✅ | ❌ | 🟡 chưa dựng — màn "thay người bảo hộ" (`/night-watch/resolve` mới là hướng dẫn chữ, chưa hành động). BLOCKERS B-COV-1 |
| `veto_registry_change` | ✅ | ❌ | 🟡 vừa thêm (2026-07-24) — admin surface hiếm dùng, chưa có UI. BLOCKERS B-COV-2 |
| `extend_ttl` | ✅ | ✅ `be/src/jobs/ttl-keeper.ts` (cron 03:00 UTC) | OK — vá ở phiên này |
| `is_registered` | ✅ | ❌ | ✅ KHÔNG phải lỗ hổng — BE đọc mirror DB do indexer ghi (indexer là người ghi duy nhất, PHA 5.2). View on-chain chỉ dùng khi cần chống-tráo |
| `get_wallet_config` | ✅ | ❌ | 🟡 BUILD-LOG PHA 5.2 khai "veto đọc `get_wallet_config` từ chain" — **grep không thấy**; thực tế route đọc mirror. Đã sửa lại BUILD-LOG. Không phải lỗ bảo mật (veto vẫn do CHÍNH VÍ ký) nhưng tài liệu từng sai |
| `get_recovery_status` | ✅ | ❌ | ✅ như `is_registered` — mirror indexer |
| `timelock_remaining` | ✅ | ❌ | 🟡 FE đếm ngược từ mirror (`timelockView`). Mirror trễ = đếm ngược lệch vài giây, không sai nghiệp vụ. Chấp nhận có chủ đích |
| **smart-account** ||||
| `__constructor` | ✅ | ✅ `fe/.../create-wallet.ts` qua `kit.createWallet` | OK |
| `recovery_rotate` | ✅ | ✅ — gọi bởi **registry** (`finalize_recovery`), không phải code app | OK (đúng thiết kế: một cửa duy nhất) |
| `set_recovery_registry` | ✅ | ❌ (có chủ đích) | ✅ đã thay bằng constructor — cửa này giờ CHỈ cho ví cũ chưa cắm; ghi đè bị chặn mã 103 |
| `get_recovery_registry` | ✅ | ❌ | 🟡 nên hiện ở màn ví ("ví này khôi phục được / chưa") — chưa dựng. BLOCKERS B-COV-3 |
| `extend_ttl` | ✅ | ✅ `be/src/jobs/ttl-keeper.ts` | OK — vá ở phiên này |
| `batch_add_signer` | ✅ | ❌ | 🟡 tính năng "nối thêm thiết bị/vỏ" chưa dựng (extension quyền hẹp — PHA 9 đường B). BLOCKERS B-COV-4 |
| `propose_recovery_registry` | ✅ | ❌ | 🟡 vừa thêm — xem `veto_registry_change` |
| `apply_recovery_registry` | ✅ | ❌ | 🟡 như trên |
| `cancel_recovery_registry_change` | ✅ | ❌ (app) / ✅ (registry gọi) | OK — cửa veto, gọi bởi registry |
| `pending_recovery_registry` | ✅ | ❌ | 🟡 như trên — cần banner cảnh báo khi có đơn đổi registry |
| `last_rotation` | ✅ | ❌ | 🔴 **LỖ HỔNG UX** — sau khôi phục ví chối MỌI chữ ký trong cooldown; không màn nào giải thích. Người dùng thấy "ví bị khoá" không rõ tới bao giờ. BLOCKERS B-COV-5 |
| **origin-verifier / verifier-webauthn** ||||
| `__constructor` | ✅ | ✅ deploy script `scripts/deploy-origin-verifier.sh` | OK |
| `verify` | ✅ | ✅ — gọi bởi **smart account** trong `__check_auth` | OK (chứng minh tx `e83adb27…`) |
| `config` | ✅ | ❌ | ✅ view chẩn đoán, không thuộc luồng người dùng |
| **web-auth** ||||
| `web_auth_verify` | ✅ | ✅ `be/src/modules/sep45/entries.ts:7` | OK |

## Chiều ngược lại — route BE gọi hàm KHÔNG tồn tại / sai chữ ký?

Đối chiếu `RECOVERY_METHODS` (`be/src/modules/recovery/domain/onchain.ts:17-22`) với
`pub fn` thật của registry v2: **5/5 khớp tên và arity**. `SIGNABLE_METHODS` (4 method
được phép xuất hiện trong entry đã ký) là tập con đúng. Không có method ma.

`CONTRACT_ERROR_NAMES` (bảng dịch mã lỗi) phủ 1..16 của registry + 100/101 của
smart-account — **thiếu 102..107 vừa thêm**; đã bổ sung trong phiên này.

## Tổng kết

- **2 lỗ hổng 🔴**: `add_guardian` (chặn wizard — §4 nối) · `last_rotation`/cooldown không có UI.
- **7 mục 🟡**: subsystem chưa dựng hoặc admin surface — mỗi mục một dòng BLOCKERS kèm lý do.
- **`extend_ttl` trước phiên này KHÔNG TỒN TẠI Ở ĐÂU** (không hàm, không job, không script) —
  đây là P0 thứ hai mà §3 dự đoán. Đã thêm hàm ở cả hai contract + cron `ttl-keeper`.
