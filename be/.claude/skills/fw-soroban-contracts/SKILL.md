---
name: fw-soroban-contracts
description: "Viết, vá và test smart contract Soroban cho FamilyWallet: Recovery Registry (guardian vote, threshold, timelock, veto) và Inheritance (heartbeat, heir claim, anchor hash di chúc). Dùng skill này BẤT CỨ KHI NÀO đụng vào thư mục contracts/, file lib.rs, soroban-sdk, hoặc user nhắc: recovery contract, guardian, threshold, timelock, veto, phiếu ma, DoS recovery, thừa kế on-chain, heartbeat, claim inheritance, anchor will hash, cargo test contract, deploy testnet contract."
---

# FamilyWallet — Soroban Contracts

Hai contract: `recovery-registry` (đã có, cần vá) và `inheritance` (viết mới). Rust, soroban-sdk 26.x, Rust ≥1.91, target `wasm32v1-none`.

## LUẬT BẤT BIẾN
1. Dữ liệu sống còn (config ví, guardians, recovery/inheritance state, will hash) ở `persistent()` hoặc `instance()` — **CẤM `temporary()`** (hết TTL là mất vĩnh viễn).
2. Mọi hàm ghi phải `require_auth()` đúng chủ thể: guardian tự approve cho mình, owner mới cancel/heartbeat/set_heir được.
3. `panic_with_error!` với error enum — không `panic!`/`unwrap()` trần (fuzz coi panic là bug).
4. Mọi chuyển trạng thái emit event (indexer + audit log phụ thuộc vào đây).
5. Validate mọi `Val` từ host trước khi lưu (checklist Veridise: round-trip không type-safe).

## RECOVERY REGISTRY — 3 lỗ hổng đã biết, PHẢI vá

**(1) DoS khóa chết recovery.** Hiện: request Pending không hết hạn, chỉ owner cancel được → kẻ xấu initiate rác đúng lúc owner mất key là ví không bao giờ khôi phục được.
Vá: thêm `expiry` vào request (`started_at + REQUEST_TTL`, mặc định 7 ngày). `initiate_recovery` gặp request hết hạn thì tự dọn rồi tạo mới. Thêm `guardian_cancel`: ≥ threshold guardian cùng ký thì hủy được request đang treo.

**(2) Phiếu ma.** Guardian bị remove sau khi đã approve — phiếu vẫn đếm.
Vá: `finalize_recovery` re-validate TỪNG phiếu với danh sách guardian HIỆN TẠI; hoặc `remove_guardian` xóa luôn phiếu của người đó khỏi request đang mở.

**(3) Collusion (trade-off, không giấu).** Guardians là classic signer, med/high threshold = 2 → 2 guardian ký chung rút được tiền, không qua contract. Không fix được ở lớp này — ghi rõ trong README + khuyến nghị 3/5 + roadmap OZ Smart Account (custody vào contract thì timelock enforce cả chi tiêu).

## INHERITANCE — interface chuẩn

```rust
set_heir(env, wallet: Address, heir: Address, silence_secs: u64)   // owner auth
heartbeat(env, wallet: Address)                                     // owner auth; last_alive = now
open_inheritance(env, wallet: Address, guardian: Address)           // chỉ khi now > last_alive + silence_secs
approve_inheritance(env, wallet: Address, guardian: Address)        // gom đủ threshold (dùng lại logic recovery)
cancel_inheritance(env, wallet: Address)                            // owner auth — veto BẤT CỨ LÚC NÀO, kể cả sau đủ phiếu
finalize_inheritance(env, wallet: Address) -> Address               // đủ phiếu + timelock riêng (7–30 ngày, DÀI hơn recovery)
anchor_will_hash(env, wallet: Address, sha256: BytesN<32>)          // owner auth; emit event mỗi bản
```
- `heartbeat` phải rẻ nhất có thể (1 write) — gọi mỗi 30 ngày.
- `finalize_inheritance` chịu chung luật chống phiếu ma + expiry như recovery.
- Timelock: `env.ledger().timestamp()`. Không dùng preAuthTx (heir key chưa biết trước).

## TEST — chuẩn nghiệm thu
`cargo test` phải cover tối thiểu: double-vote; finalize thiếu phiếu; finalize trước timelock; veto-sau-đủ-phiếu chặn finalize; removed-guardian-vote không đếm; request hết hạn tự dọn; guardian_cancel đủ/thiếu threshold; heartbeat reset đồng hồ; open_inheritance trước hạn bị chặn; register 2 lần cùng wallet bị chặn.
Fuzz: `cargo fuzz` target cho chuỗi initiate→approve→finalize với input random (Stellar tích hợp sẵn cargo-fuzz; chụp kết quả vào README mục Security).

## BUILD & DEPLOY TESTNET
```bash
cargo test && stellar contract build
stellar contract optimize --wasm target/wasm32v1-none/release/<ten>.wasm
stellar contract deploy --wasm <file>.optimized.wasm --source deployer --network testnet
```
Sau deploy: cập nhật CONTRACT_ID vào `.env` FE + README + STATUS.md, verify trên `stellar.expert/explorer/testnet/contract/<ID>`. Mainnet → dùng skill `stellar-mainnet-deploy`.

## BẪY ĐÃ TRẢ GIÁ
- `soroban-sdk 26` đổi API test: `Address::generate(&env)`, `env.mock_all_auths()`, `.into()` cho val — code test cũ 11 chỗ lỗi kiểu này.
- Thiếu `Cargo.lock` trong git = giám khảo/CI build khác version → commit Cargo.lock.
- `stellar keys rm` trong script demo phải kèm `--force`, và mỗi script tự lo register wallet của nó (không phụ thuộc script trước).
