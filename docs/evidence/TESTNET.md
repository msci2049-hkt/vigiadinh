# Bằng chứng testnet — hạ tầng on-chain đã deploy

> Mọi ID/hash ở đây là THẬT trên Stellar testnet, kèm link stellar.expert
> (luật stellar.md: cấm placeholder trong bản nộp). Cập nhật khi deploy thêm.

## PHA 2.1 — Spike verifier (GATE 3, 2026-07-23)

| Gì | Giá trị |
|---|---|
| Contract `verifier-webauthn` (spike, SDK 27) | `CBJ4JOO2H5GFZYI3RVGRWICYPZMTWVRW424U5YQHU34JKDMNZWGLG7WP` |
| Kết quả | MỘT credential ký 3 origin (web/APK/ext) → verifier nhận cả 3; origin lạ → `Error(Contract,#5)` OriginNotAllowed |
| Chi tiết + 3 tx hash | `../../SPIKE-PASSKEY.md` (root repo) |

## PHA 2.3 — SEP-45 + hạ tầng kit (2026-07-24)

| Gì | Giá trị | Link |
|---|---|---|
| Contract `web-auth` (SEP-45 `web_auth_verify`) | `CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST` | [tx deploy](https://stellar.expert/explorer/testnet/tx/ee36e934e337346f7187afe50f9fe45b847e020d3fe89255ec1fbcb1b7e1c074) · [contract](https://stellar.expert/explorer/testnet/contract/CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST) |
| WASM `smart-account` (upload, chưa deploy instance) | hash `87194f6100c81fd5c290ca6a28034bc9ef2f6e42b2f7e73eefae37d5ad3b02a8` | [tx upload](https://stellar.expert/explorer/testnet/tx/78159d52cd6ecd655d782370bc624721ba8a713ebac5fedfa495c81835acbe16) |
| Contract `origin-verifier` bản DEV (rpId=localhost, origins `http://localhost:5173`+`:4174`) | `CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N` | [contract](https://stellar.expert/explorer/testnet/contract/CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N) |
| SEP-45 signing account (dev) | `GB36727O4PD6ASHCJAREPS7XJZZL467LHETUTQYLFGJXFNZYRZQOBQBP` | [account](https://stellar.expert/explorer/testnet/account/GB36727O4PD6ASHCJAREPS7XJZZL467LHETUTQYLFGJXFNZYRZQOBQBP) |

### Smoke SEP-45 sống (dev server + testnet thật, 2026-07-24)

- `GET /api/sep45/challenge?account=CAKV…` → 200, entries có chữ ký server.
- `POST /api/sep45/token` với entry client CHƯA ký → 400
  `SIMULATION_FAILED: Error(Auth, InvalidAction)` từ `require_auth` — nghĩa là
  contract trên testnet THẬT đang cưỡng chế auth trong simulation của BE.
- Nộp lại cùng challenge → 400 `NONCE_UNKNOWN_OR_USED` (nonce single-use).

⚠️ `origin-verifier` DEV chỉ dành cho localhost — production deploy instance mới
pin rpIdHash domain thật + allow-list 3 origin (web / `android:apk-key-hash:…` /
`chrome-extension://…`), xem skill stellar-passkey-smart-account §1.
