# Luật Stellar — FamilyWallet

- Passphrase testnet `Test SDF Network ; September 2015` · mainnet `Public Global Stellar Network ; September 2015`. Sai passphrase = mọi chữ ký invalid — mọi cấu hình network qua env, cấm hardcode.
- Soroban KHÔNG phát được classic op (SetOptions...). Contract chỉ gate + emit event; client build & submit tx classic. Cấm viết code/tài liệu nói ngược điều này.
- RPC giữ ~7 ngày lịch sử → indexer bắt buộc checkpoint; cần lịch sử dài dùng Horizon/archive RPC.
- TTL: contract instance + wasm + persistent keys phải có cron extend (skill stellar-mainnet-deploy). Quên = contract "biến mất" — sự cố production kinh điển nhất.
- Fee sponsor: OpenZeppelin Relayer (Launchtube đã bị SDF khai tử — cấm thêm dependency mới vào Launchtube).
- SDK: `@stellar/stellar-sdk` v16 dùng `rpc.Server` (không còn `SorobanRpc`), `Horizon.Server` cho classic; Freighter v6 trả `{ address }` / `{ signedTxXdr }`.
- Mọi giao dịch demo/tài liệu phải kèm link `stellar.expert` thật — cấm để placeholder `[CONTRACT_ID]` trong bản nộp/công bố.
