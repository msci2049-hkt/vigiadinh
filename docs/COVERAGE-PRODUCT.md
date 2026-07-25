# COVERAGE-PRODUCT — hàm contract nào có ĐƯỜNG SẢN PHẨM gọi tới?

> Quét 2026-07-24, cập nhật sau phiên 2026-07-25 (§1/§3/§4 của CHẶNG CUỐI). Lớp lỗi cần bắt: **hàm đã cài + đã test on-chain
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
| `add_guardian` | ✅ | ✅ `be/.../onchain.ts` + FE `/setup/invite` | ✅ ĐÃ VÁ 2026-07-24 |
| `remove_guardian` | ✅ | ❌ | 🟡 chưa dựng — màn "thay người bảo hộ" (`/night-watch/resolve` mới là hướng dẫn chữ, chưa hành động). BLOCKERS B-COV-1 |
| `veto_registry_change` | ✅ | ❌ | 🟡 admin surface hiếm dùng, chưa có UI — CÓ CHỦ ĐÍCH (BLOCKERS B-COV-2): dựng cửa trước khi có registry v3 là dựng cửa cho kẻ tấn công |
| `extend_ttl` | ✅ | ✅ `be/src/jobs/ttl-keeper.ts` (cron 03:00 UTC) | OK — vá ở phiên này |
| `is_registered` | ✅ | ✅ `wallets/features/recovery-config` + `recovery/features/chain-truth` | ✅ ĐÃ NỐI 2026-07-25 — gác việc sửa ngưỡng sau khi đã đăng ký |
| `get_wallet_config` | ✅ | ✅ `recovery/features/chain-truth` → FE `/block` | ✅ ĐÃ NỐI 2026-07-25. **Đính chính:** phiên trước kết luận đây "chỉ là lỗi tài liệu, không phải lỗ bảo mật" — đúng về QUYỀN (veto vẫn do chính ví ký) nhưng **sai về TÍNH SỐNG**: chủ ví chỉ chặn được nếu BIẾT có khôi phục đang mở, mà biết là nhờ mirror do indexer ghi. Indexer chết trong cửa sổ timelock = không ai báo = khôi phục hoàn tất, không cần phá chữ ký nào |
| `get_recovery_status` | ✅ | ✅ `chain-truth` + cron `recovery-watch` | ✅ ĐÃ NỐI 2026-07-25 — cron cảnh báo qua email KHÔNG dùng chung phụ thuộc với indexer |
| `timelock_remaining` | ✅ | ✅ `chain-truth` → đếm ngược ở `/block` | ✅ ĐÃ NỐI 2026-07-25 — đếm ngược lấy từ chain, không từ mirror |
| **smart-account** ||||
| `__constructor` | ✅ | ✅ `fe/.../create-wallet.ts` qua `kit.createWallet` | OK |
| `recovery_rotate` | ✅ | ✅ — gọi bởi **registry** (`finalize_recovery`), không phải code app | OK (đúng thiết kế: một cửa duy nhất) |
| `set_recovery_registry` | ✅ | ❌ (có chủ đích) | ✅ đã thay bằng constructor — cửa này giờ CHỈ cho ví cũ chưa cắm; ghi đè bị chặn mã 103 |
| `get_recovery_registry` | ✅ | ✅ `chain-truth` (cooldown) + hub ví | ✅ ĐÃ NỐI 2026-07-25 |
| `extend_ttl` | ✅ | ✅ `be/src/jobs/ttl-keeper.ts` | OK — vá ở phiên này |
| `batch_add_signer` | ✅ | ❌ | 🟡 tính năng "nối thêm thiết bị/vỏ" chưa dựng (extension quyền hẹp — PHA 9 đường B). BLOCKERS B-COV-4 |
| `propose_recovery_registry` | ✅ | ❌ | 🟡 vừa thêm — xem `veto_registry_change` |
| `apply_recovery_registry` | ✅ | ❌ | 🟡 như trên |
| `cancel_recovery_registry_change` | ✅ | ❌ (app) / ✅ (registry gọi) | OK — cửa veto, gọi bởi registry |
| `pending_recovery_registry` | ✅ | ❌ | 🟡 cần banner khi có đơn đổi registry — gắn với B-COV-2, làm cùng lúc |
| `last_rotation` | ✅ | ✅ `chain-truth` → `CooldownNotice` ở hub ví | ✅ ĐÃ VÁ 2026-07-25 — nói rõ đang bảo vệ · còn bao lâu · vì sao · làm gì được |
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

## Tổng kết (cập nhật 2026-07-25)

- **KHÔNG còn mục 🔴 nào.** Hai lỗ đỏ của lần quét trước đã vá: `add_guardian` có đường sản
  phẩm (wizard mức B), `last_rotation`/cooldown đã có UI giải thích.
- **Còn 3 mục 🟡**, đều là "chưa dựng CÓ CHỦ ĐÍCH", mỗi mục một dòng BLOCKERS kèm lý do:
  `remove_guardian` (B-COV-1) · đổi registry propose/apply/veto/pending (B-COV-2) ·
  `batch_add_signer` (B-COV-4).
- **`extend_ttl` trước ngày 2026-07-24 KHÔNG TỒN TẠI Ở ĐÂU** — đã thêm hàm ở cả hai contract +
  cron `ttl-keeper`. ⚠️ Mức nghiêm trọng THẤP hơn ghi ban đầu: từ Protocol 23 entry archive tự
  động khôi phục, nên quên gia hạn chỉ tốn phí, không mất ví (`docs/INHERITANCE.md`).
- 5 view on-chain (`is_registered`, `get_wallet_config`, `get_recovery_status`,
  `timelock_remaining`, `get_recovery_registry`) từ chỗ **không ai gọi** nay là nguồn sự thật
  của màn veto và hub ví — đây chính là thứ đóng lỗ hổng tính-sống ở §3.
