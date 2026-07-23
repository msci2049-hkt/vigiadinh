---
name: stellar-mainnet-deploy
description: "Hướng dẫn đầy đủ để đưa dự án Stellar/Soroban từ Testnet lên MAINNET production — cấu hình CLI, chọn RPC provider, nạp XLM, deploy contract, quản lý TTL/state archival, chuyển frontend/backend, bảo mật khóa và checklist go-live. Dùng skill này BẤT CỨ KHI NÀO user nhắc đến deploy mainnet, lên mainnet, go-live Stellar, production Stellar, publish contract Soroban, chuyển từ testnet sang mainnet, 'Public Global Stellar Network', nạp XLM thật để deploy, RPC mainnet, extend TTL trên mainnet, hoặc muốn phát hành ví/dapp/token Stellar cho người dùng thật — kể cả khi họ chỉ nói 'đưa dự án lên chạy thật' hay 'launch con này đi'."
---

# Stellar Mainnet Deploy — Đưa dự án Soroban lên Mainnet

Skill này hướng dẫn quy trình chuẩn để chuyển một dự án Stellar (Soroban contract + Classic ops + frontend/backend) từ Testnet lên Mainnet an toàn. Làm theo THỨ TỰ các bước. Đừng bỏ qua checklist bảo mật.

**Nguyên tắc bất di bất dịch:** Mainnet là tiền thật, không có reset, không có Friendbot, không có undo. Sai `SetOptions`/thresholds có thể khóa account VĨNH VIỄN. Mọi thứ phải chạy end-to-end trên Testnet trước, rồi mới lặp lại y hệt trên Mainnet.

---

## 0. Khác biệt cốt lõi Testnet vs Mainnet

| | Testnet | Mainnet |
|---|---|---|
| Network passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| XLM | Miễn phí qua Friendbot | Tiền thật — mua từ sàn, chuyển về |
| RPC công khai của SDF | `https://soroban-testnet.stellar.org` | **KHÔNG CÓ** — phải chọn provider bên thứ 3 (xem `references/rpc-providers.md`) |
| Horizon | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` (rate-limit, không SLA — production nên dùng provider) |
| Explorer | `stellar.expert/explorer/testnet` | `stellar.expert/explorer/public` |
| Reset | Định kỳ (mất hết data) | Không bao giờ |
| Sai lầm | Sửa được | Có thể mất tiền / khóa account vĩnh viễn |

Passphrase là một phần của chữ ký giao dịch — sai passphrase = mọi chữ ký invalid. Đây là lỗi số 1 khi chuyển mạng.

---

## 1. Checklist TRƯỚC khi deploy (bắt buộc)

Đọc `references/checklist.md` và đi qua từng mục. Tóm tắt các nhóm:

1. **Code**: đã test đầy đủ (unit + e2e trên testnet), không còn code mock/test/debug, không hardcode contract ID hay URL testnet — tất cả qua env vars.
2. **Quyền admin**: xác định rõ contract có upgradeable không (`update_current_contract_wasm`); nếu có, admin key phải là multisig hoặc ví lạnh, KHÔNG phải key dev. Nếu immutable — chấp nhận là deploy xong không sửa được, chỉ deploy contract mới.
3. **Storage**: mọi dữ liệu quan trọng (balance, danh sách, config) phải nằm ở `persistent` hoặc `instance` storage — TUYỆT ĐỐI không để ở `temporary` (temporary hết TTL là XÓA VĨNH VIỄN, không restore được; TTL temporary mặc định trên mainnet chỉ khoảng 1 ngày).
4. **Khóa**: key deploy là key mới, tạo an toàn, seed không nằm trong repo/.env commit. Kiểm tra `git log -p | grep -i secret` cho chắc.
5. **Chi phí**: đã ước tính phí deploy + rent (mục 5) và account deploy có đủ XLM dư.

---

## 2. Cấu hình CLI & khóa

```bash
# Thêm network mainnet (thay RPC_URL bằng provider đã chọn — xem references/rpc-providers.md)
stellar network add mainnet \
  --rpc-url "https://mainnet.sorobanrpc.com" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --global

# Tạo key deploy MỚI (đừng generate với --fund — mainnet không có friendbot)
stellar keys generate deployer-main --no-fund
stellar keys address deployer-main        # in ra địa chỉ G... để nạp tiền

# Hoặc import key có sẵn (nhập seed S... khi được hỏi, không gõ thẳng vào lệnh)
stellar keys add deployer-main
```

**Nạp XLM:** mua XLM trên sàn (Binance/OKX/Coinbase...), rút về địa chỉ `G...` của key deploy. Lưu ý:
- Account chỉ tồn tại sau khi nhận ≥ 1 XLM (base reserve 0.5 + buffer). Rút từ sàn thường không cần memo cho ví cá nhân, nhưng KIỂM TRA kỹ trước khi rút.
- Khuyến nghị nạp **10–20 XLM** cho account deploy: đủ cho upload wasm + deploy + rent ban đầu + reserves, dư để vận hành.
- Xác nhận tiền về: `stellar keys address deployer-main` rồi tra trên `https://stellar.expert/explorer/public/account/G...`

---

## 3. Build & tối ưu wasm

```bash
# Build release (stellar-cli mới dùng target wasm32v1-none; bản cũ dùng wasm32-unknown-unknown)
stellar contract build
# hoặc: cargo build --target wasm32v1-none --release

# Tối ưu size (cần cài: cargo install --locked stellar-cli --features opt)
stellar contract optimize --wasm target/wasm32v1-none/release/ten_contract.wasm
```

Wasm nhỏ hơn = phí upload + rent thấp hơn. Luôn optimize trước khi lên mainnet.

---

## 4. Deploy contract lên Mainnet

```bash
# Bước 1: upload wasm → nhận WASM_HASH
stellar contract upload \
  --wasm target/wasm32v1-none/release/ten_contract.optimized.wasm \
  --source deployer-main \
  --network mainnet

# Bước 2: deploy instance từ wasm hash → nhận CONTRACT_ID (C...)
stellar contract deploy \
  --wasm-hash <WASM_HASH> \
  --source deployer-main \
  --network mainnet
# Nếu contract có constructor: thêm  -- --arg1 gia_tri1 --arg2 gia_tri2

# Khởi tạo (nếu có hàm init/set_admin...)
stellar contract invoke --id <CONTRACT_ID> --source deployer-main --network mainnet \
  -- initialize --admin G...
```

**Ngay sau khi deploy, LƯU LẠI và commit vào tài liệu dự án:**
- `CONTRACT_ID` (C...), `WASM_HASH`, tx hash deploy, địa chỉ deployer
- Link verify: `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`

Lệnh chi tiết hơn (invoke, xem events, script JS/SDK) — đọc `references/commands.md`.

---

## 5. TTL & State Archival trên Mainnet (KHÔNG ĐƯỢC BỎ QUA)

Mọi thứ trên Soroban đều có TTL (thuê chỗ, đo bằng số ledger; 1 ledger ≈ 5 giây):
- **Contract instance + wasm code + persistent data**: hết TTL → bị **archive** (đóng băng). Restore được bằng phí, và từ Protocol 23 việc restore diễn ra tự động khi invoke chạm vào entry bị archive (qua restore list lúc simulate) — nhưng vẫn tốn phí và làm giao dịch nặng hơn. Chủ động extend vẫn là cách đúng.
- **Temporary data**: hết TTL → **XÓA VĨNH VIỄN**.

```bash
# Xem thông số TTL/phí hiện hành của mainnet (số thay đổi theo validator vote — đừng hardcode)
stellar network settings --network mainnet
# hoặc xem bảng: https://lab.stellar.org/network-limits (chọn Mainnet)

# Extend TTL contract instance + code
stellar contract extend --id <CONTRACT_ID> \
  --source deployer-main --network mainnet \
  --ledgers-to-extend 535679 --durability persistent

# Extend một persistent key cụ thể
stellar contract extend --id <CONTRACT_ID> --key <KEY> \
  --source deployer-main --network mainnet \
  --ledgers-to-extend 535679 --durability persistent

# Restore entry đã bị archive
stellar contract restore --id <CONTRACT_ID> --source deployer-main --network mainnet
```

**Bắt buộc cho production:** đặt cron job (tuần/tháng) extend TTL cho contract instance, wasm hash, và các persistent key sống còn. Hoặc viết logic trong contract tự `extend_ttl()` mỗi lần được gọi. Không làm → vài tháng sau contract "biến mất" với user, và đó là sự cố production kinh điển nhất trên Soroban.

---

## 6. Chuyển frontend / backend sang Mainnet

Tất cả qua biến môi trường — một chỗ đổi, cả app đổi:

```env
# .env.production
VITE_STELLAR_NETWORK=PUBLIC
VITE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
VITE_RPC_URL=https://<rpc-provider-mainnet>
VITE_HORIZON_URL=https://horizon.stellar.org
VITE_CONTRACT_ID=C...   # contract ID mainnet vừa deploy
```

- **JS SDK**: dùng `Networks.PUBLIC` (stellar-sdk) thay `Networks.TESTNET` khi build transaction.
- **Freighter / ví**: user phải tự chuyển ví sang Mainnet. App nên kiểm tra network của ví (`getNetwork()`) và chặn + báo lỗi rõ ràng nếu ví đang ở Testnet — đây là lỗi user gặp nhiều nhất ngày go-live.
- **Horizon production**: `horizon.stellar.org` bị rate-limit và không có SLA. App có traffic → dùng Horizon/RPC của provider (xem `references/rpc-providers.md`) hoặc tự chạy node.
- **Gasless/fee sponsorship**: Launchtube đã bị SDF ngừng phát triển và thay bằng **OpenZeppelin Relayer (Stellar Channels Service)** — production cần sponsor phí thì dùng OZ Relayer hoặc tự làm fee-bump transaction.

---

## 7. Classic multisig / SetOptions trên Mainnet (cho ví, social recovery...)

Cơ chế y hệt testnet, chỉ khác passphrase — nhưng độ rủi ro khác hẳn:
- **Sai thresholds = khóa account vĩnh viễn.** Ví dụ: đặt high threshold = 20 khi tổng weight các signer chỉ còn 10 → không ai đổi được gì nữa, mãi mãi.
- Quy trình an toàn khi đổi signer/threshold trên mainnet: (1) mô phỏng chính xác kịch bản trên testnet với cùng weights; (2) trên mainnet, thêm signer mới TRƯỚC, xác nhận ký được, RỒI mới hạ weight/xóa key cũ; (3) mỗi lần `SetOptions` chỉ đổi MỘT thứ, verify trên explorer, rồi mới đổi tiếp.
- Mỗi signer thêm vào account tốn thêm 0.5 XLM base reserve.

## 8. Sau go-live

- Theo dõi contract: `stellar.expert/explorer/public/contract/<ID>`, RPC `getEvents`, đặt alert khi tx fail bất thường.
- Lịch extend TTL (mục 5) chạy đều.
- Key admin cất ví lạnh/multisig; key deploy hằng ngày chỉ giữ ít XLM.
- Ghi lại runbook: contract ID, wasm hash, cách upgrade (nếu có), ai giữ key nào.

---

## Tham chiếu

- `references/rpc-providers.md` — đọc khi cần chọn/đổi RPC hoặc Horizon provider cho mainnet.
- `references/commands.md` — đọc khi cần lệnh CLI đầy đủ, ví dụ script JS/SDK, deploy bằng CI.
- `references/checklist.md` — đọc và tick từng mục NGAY TRƯỚC ngày deploy thật.

Docs gốc: `developers.stellar.org/docs/networks` (networks & passphrase), `/docs/data/apis/rpc/providers` (RPC), `/docs/build/guides/archival` (TTL), `/docs/build/security-docs` (bảo mật), `lab.stellar.org/network-limits` (phí & giới hạn hiện hành).
