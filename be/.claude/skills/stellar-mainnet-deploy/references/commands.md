# Lệnh & Script chi tiết — Testnet → Mainnet

## 1. Cài đặt / cập nhật tooling

```bash
# Rust + target wasm
rustup target add wasm32v1-none          # stellar-cli mới (bản cũ: wasm32-unknown-unknown)

# Stellar CLI (kèm optimizer)
cargo install --locked stellar-cli --features opt
stellar --version
```

## 2. Network & keys

```bash
# Xem networks đã cấu hình
stellar network ls

# Thêm mainnet
stellar network add mainnet \
  --rpc-url "<RPC_MAINNET>" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --global

# Đặt mặc định để đỡ gõ --network mỗi lệnh (cẩn thận: dễ quên đang ở mainnet!)
stellar network use mainnet

# Keys
stellar keys generate deployer-main --no-fund   # tạo mới, KHÔNG friendbot
stellar keys add deployer-main                  # import seed có sẵn (nhập khi được hỏi)
stellar keys address deployer-main              # in địa chỉ G...
stellar keys use deployer-main                  # đặt làm source mặc định
```

Seed lưu ở `~/.config/stellar/identity/` (máy local). Với CI: truyền qua biến môi trường `STELLAR_ACCOUNT`/`--source-account` với secret của CI, không commit.

## 3. Build → optimize → upload → deploy → invoke

```bash
stellar contract build
stellar contract optimize --wasm target/wasm32v1-none/release/my_contract.wasm

stellar contract upload \
  --wasm target/wasm32v1-none/release/my_contract.optimized.wasm \
  --source deployer-main --network mainnet
# => in ra WASM_HASH

stellar contract deploy \
  --wasm-hash <WASM_HASH> \
  --source deployer-main --network mainnet \
  -- --admin G...            # args constructor nếu contract có __constructor
# => in ra CONTRACT_ID (C...)

# (Cách gộp: deploy thẳng từ --wasm, CLI tự upload)
stellar contract deploy --wasm <file.wasm> --source deployer-main --network mainnet

# Invoke hàm
stellar contract invoke --id <CONTRACT_ID> --source deployer-main --network mainnet \
  -- ten_ham --tham_so gia_tri

# Đọc không tốn phí (simulate): thêm --send=no khi chỉ muốn xem kết quả view function
```

## 4. TTL: extend / restore

```bash
# Thông số mạng hiện hành (min/max TTL, phí rent) — đừng hardcode số
stellar network settings --network mainnet

# Extend instance + code của contract
stellar contract extend --id <CONTRACT_ID> \
  --ledgers-to-extend 535679 --durability persistent \
  --source deployer-main --network mainnet

# Extend 1 key persistent cụ thể (key phức tạp thì dùng --key-xdr base64)
stellar contract extend --id <CONTRACT_ID> --key COUNTER \
  --ledgers-to-extend 535679 --durability persistent \
  --source deployer-main --network mainnet

# Restore entry đã archive
stellar contract restore --id <CONTRACT_ID> \
  --source deployer-main --network mainnet
```

Cron mẫu (chạy mỗi tuần):

```bash
#!/usr/bin/env bash
set -e
for ID in C_CONTRACT_1 C_CONTRACT_2; do
  stellar contract extend --id "$ID" \
    --ledgers-to-extend 535679 --durability persistent \
    --source deployer-main --network mainnet
done
```

## 5. JS/TS SDK (frontend & backend)

```ts
import { Networks, rpc, TransactionBuilder, Contract, BASE_FEE } from '@stellar/stellar-sdk';

const RPC_URL = import.meta.env.VITE_RPC_URL;              // mainnet provider
const PASSPHRASE = Networks.PUBLIC;                        // = "Public Global Stellar Network ; September 2015"
const server = new rpc.Server(RPC_URL);

const account = await server.getAccount(publicKey);
const contract = new Contract(import.meta.env.VITE_CONTRACT_ID);

let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
  .addOperation(contract.call('ten_ham', ...args))
  .setTimeout(60)
  .build();

tx = await server.prepareTransaction(tx);   // simulate: điền resource fee + footprint + auth
// ký bằng Freighter/ví → server.sendTransaction(signedTx) → poll getTransaction
```

Kiểm tra ví đúng mạng (Freighter):

```ts
import { getNetwork } from '@stellar/freighter-api';
const { network, networkPassphrase } = await getNetwork();
if (networkPassphrase !== Networks.PUBLIC) {
  throw new Error('Ví đang ở ' + network + ' — hãy chuyển Freighter sang Mainnet');
}
```

## 6. Classic ops trên mainnet (payment, SetOptions...)

Giống hệt testnet, chỉ đổi `networkPassphrase: Networks.PUBLIC` và Horizon/RPC mainnet. Với `SetOptions` (đổi signer/threshold): đọc mục 7 của SKILL.md — đổi từng bước một, verify từng bước trên `stellar.expert/explorer/public`.

## 7. Fee & sponsor

- Phí = inclusion fee (min 100 stroops/op = 0.00001 XLM) + resource fee (Soroban, tự tính khi simulate). Deploy + init một contract thường tốn dưới vài XLM kể cả rent ban đầu.
- Muốn user không trả phí: fee-bump transaction (account của mày bọc và trả phí cho tx của user), hoặc dịch vụ **OpenZeppelin Relayer / Stellar Channels Service** (thay thế chính thức cho Launchtube đã ngừng). Docs: developers.stellar.org/docs/tools/openzeppelin-relayer.

## 8. Verify sau deploy

- Contract: `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`
- Account:  `https://stellar.expert/explorer/public/account/<G...>`
- Tx:       `https://stellar.expert/explorer/public/tx/<HASH>`
- Events:   RPC `getEvents` (nhớ RPC chỉ giữ ~7 ngày; cần dài hơn → archive RPC/indexer).
