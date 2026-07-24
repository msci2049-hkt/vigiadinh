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

## PHA 5.2 — Route ghi recovery nối contract (2026-07-24)

Contract registry (spike cũ, dùng lại): `CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V`
([contract](https://stellar.expert/explorer/testnet/contract/CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V)).
Ví phí (tách custody, ký ENVELOPE trả phí — không giữ quyền): `GCJT4UD4NCUHDTJTPFWFK3JD7Z3RRDCYVSD3GNQAFTH3JZPGZ2M64B4C`.

**E2e 3 luồng GATE PHA 5 — chạy THẬT trên testnet 2026-07-24**
(`RUN_TESTNET_E2E=1 bun test onchain.e2e` → 4 pass / 0 fail, 90s; đường đi:
`buildRecoveryAction` → FE ký ed25519 `authorizeEntry` → `submitRecoveryAction`
validate whitelist → ví phí ký envelope → submit + poll):

| Luồng | Bước | Tx |
|---|---|---|
| 1 · Thiết lập | `register_wallet` (owner ký) | [b272809e](https://stellar.expert/explorer/testnet/tx/b272809e9fb25f0f5afc00b619ff0aedaff92d97f2ed750942a28906528a40a5) |
| 2 · Khôi phục timelock thật | `initiate_recovery` (guardian 1) | [69e7315f](https://stellar.expert/explorer/testnet/tx/69e7315f379348c62a3cad653825889567903408c1d23b591866c45255b5332a) |
| 2 | `approve_recovery` (guardian 1) | [8a77e4f3](https://stellar.expert/explorer/testnet/tx/8a77e4f3c24ac2cdf4e2fb4b8ec21a9de9e48b1b444de6c6f07ca9d903bcf946) |
| 2 | `approve_recovery` (guardian 2 → đủ ngưỡng 2) | [0a342396](https://stellar.expert/explorer/testnet/tx/0a3423964c67aa1c1caceed92d7573fbb0f57e3f3cc19739aea68ca3657b8897) |
| 2 | chờ `timelock_remaining=0` THẬT (6s) → `finalize_recovery`; `get_wallet_config.owner` = chủ mới ✅ | [c00d7e85](https://stellar.expert/explorer/testnet/tx/c00d7e853d77d73a0708f75330ce2422c3bd02174cce36d686d21d1929a4506c) |
| 3 · Veto khẩn | `register_wallet` ví 2 (timelock 3600s) | [b2145906](https://stellar.expert/explorer/testnet/tx/b21459061aec666a3ff6884654a24fe77b32ab0cc880b4d7aac178ec65c44b95) |
| 3 | `initiate_recovery` (guardian 1) | [641537f2](https://stellar.expert/explorer/testnet/tx/641537f2042867b648966ba9fe1aca2f44ab1a3c800346759b033aa0b6226964) |
| 3 | `cancel_recovery` = VETO (owner ký) — approve sau đó chết đúng `Error(Contract)` RecoveryCancelled/NoActiveRecovery ✅ | [144b7fb6](https://stellar.expert/explorer/testnet/tx/144b7fb67476fc667fd247e85060b284f0fb21103f158f1cdf37945cfc2ae2d7) |

Audit GATE 5 (custody): `grep Keypair.fromSecret|.sign(` ngoài test = 4 hit, toàn bộ
là ví phí (`services/stellar`) + SEP-45 server key — **0 chỗ ký thay người dùng**.
