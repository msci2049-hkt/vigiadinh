# RESEARCH-LOG — family-wallet

> Nhật ký tra cứu theo operator §2.4. Mỗi lần tra ghi một mục; đã có trong đây thì DÙNG LẠI, cấm tra lại.

### 2026-07-23 · PHA 2.3 · smart-account-kit API thật (bản đã cài)

- Hỏi: API thật của smart-account-kit — config, ký auth entry, storage, challenge K2 nằm đâu?
- Nguồn: `fe/node_modules/.pnpm/smart-account-kit@0.4.2_@stellar+stellar-sdk@16.0.1/…/dist/{index,kit,types,signers,kit/auth-payload}.d.ts` (ĐÃ CÀI, không phải docs)
- Kết luận:
  - `new SmartAccountKit(config)` — bắt buộc: `rpcUrl`, `networkPassphrase`, `accountWasmHash`, `webauthnVerifierAddress`; tùy chọn: `rpId`, `rpName`, `storage` (StorageAdapter — IndexedDB/LocalStorage/Memory có sẵn), `relayerUrl`, `indexerUrl: string|false`, `deployerSecret` (mặc định = keypair CÔNG KHAI derive từ seed cố định — chỉ trả phí, không giữ quyền).
  - Ký: `kit.signAuthEntry(entry, {credentialId, expiration})` — ký MỘT SorobanAuthorizationEntry bằng passkey. Challenge WebAuthn = **P27 auth digest** = `sha256(sha256(HashIdPreimage) ++ scvVec(context_rule_ids).toXDR())` (`computeEntryAuthDigest` export sẵn) → đúng K2 challenge-dẫn-xuất-từ-tx, kit làm natively.
  - `kit.sign(assembledTx)` KHÔNG re-simulate — chữ ký WebAuthn to hơn placeholder → PHẢI re-simulate trước submit; `kit.signAndSubmit` làm đủ chuỗi.
  - `connectWallet()` silent restore / `{prompt:true}` / `{fresh:true}`; `authenticatePasskey()` trả credentialId để tra indexer; `createWallet(appName, userName, opts)`.
  - peer: `@stellar/stellar-sdk >=16` (khớp bản 16.0.1 FE đã có), engines node>=22 (chỉ là khai báo build của kit, Vite bundle không đụng).
- Áp vào: `fe/apps/web/src/features/wallet/*` (PHA 2.3), config qua env `VITE_STELLAR_*`.
- Mâu thuẫn skill? Không — skill §2 nói đúng (storage adapter, VITE_RELAYER_URL, StellarWalletsKitAdapter có thật trong .d.ts).
- TODO xác minh (PHA 5): `accountWasmHash` kit kỳ vọng là OZ smart account bản kalepail build (bindings 0.3.0, P27 digest + context-rule-id binding). `contracts/smart-account` của ta wrap OZ 0.7.2 trên SDK 26.1.1 — cần đối chiếu format AuthPayload/`__check_auth` trước khi cho kit ký tx thật vào contract của ta.

### 2026-07-23 · PHA 2.3 · SEP-45 (Web Auth cho contract account)

- Hỏi: challenge/verify SEP-45 gồm những gì, contract web-auth phải làm gì, JWT claims nào?
- Nguồn: `stellar/stellar-protocol` `ecosystem/sep-0045.md` (raw.githubusercontent, đọc 2026-07-23)
- Kết luận:
  - GET challenge: params `account` (C…), `home_domain`, optional `client_domain` → trả `authorization_entries` (XDR `SorobanAuthorizationEntries`) + `network_passphrase`. Mỗi entry: root invocation `contract_fn` gọi `web_auth_verify(args: Map<Symbol,String>)` trên `WEB_AUTH_CONTRACT_ID`, KHÔNG sub-invocation. Args: `account`, `home_domain`, `web_auth_domain`, `web_auth_domain_account` (= SIGNING_KEY server), `nonce` (unique, giống nhau giữa các entry), optional `client_domain`/`client_domain_account`.
  - Entries: 1 entry cho server account (server ký), 1 entry cho client account (client ký qua `__check_auth`), optional client_domain.
  - POST token: client nộp entries đã ký. Server validate: contract addr = WEB_AUTH_CONTRACT_ID · fn = `web_auth_verify` · args khớp + nhất quán · nonce chưa dùng + chưa quá hạn (chống replay, không phát 2 JWT cho 1 challenge) · có entry server ký hợp lệ · có entry client account · rồi DỰNG TX invokeHostFunction từ chính entries đó → **simulate qua RPC, thành công mới phát JWT**.
  - JWT claims: `iss`, `sub` = C… address, `iat`, `exp`, optional `client_domain`. (Dự án thêm claim `device` — bind thiết bị theo checklist, không trái spec.)
  - Contract web-auth: `require_auth(account)` + `require_auth(server_account)` (+ optional client_domain account); các args khác contract BỎ QUA. Reference impl: `github.com/stellar/sep45-reference` (có contract Pubnet, chưa thấy nói testnet — tự viết contract ~40 dòng trong `contracts/` SDK 26.1.1 cho chủ động).
- Áp vào: `be/src/modules/sep45/*` + `contracts/web-auth/`.
- Mâu thuẫn skill? Không — skill passkey §5 nói đúng hướng (SEP-45 cho contract account, bind ví + device).

### 2026-07-23 · PHA 2.3 · Playwright 1.61 virtual authenticator (bản đã cài)

- Hỏi: API virtual authenticator của Playwright 1.61 đúng tên gì?
- Nguồn: `fe/node_modules/.pnpm/playwright-core@1.61.0/…/types/types.d.ts` (interface `Credentials`, ~dòng 9559+)
- Kết luận: `context.credentials.install()` (PHẢI gọi trước khi trang đụng `navigator.credentials`) · `context.credentials.create(rpId, {id?, privateKey?, publicKey?, userHandle?})` seed credential P-256 discoverable (trả cả private key → persist để tái dùng giữa test) · `.get({rpId?, id?})` · `.delete(id)`. Khớp checklist 2.3.
- Áp vào: `fe/apps/web/e2e/passkey-login.spec.ts`.
- Mâu thuẫn skill? Không.

### 2026-07-24 · PHA 2.3 · Wire format `authorization_entries` + bug js-xdr

- Hỏi: `authorization_entries` encode thế nào — một blob hay JSON array?
- Nguồn: ví dụ JSON trong `sep-0045.md` (decode thử prefix `AAAAAg` = uint32 count 2) + `.d.ts` SDK 16.0.1 (`xdr.SorobanAuthorizationEntries: XDRArray<SorobanAuthorizationEntry>`).
- Kết luận: MỘT chuỗi base64 XDR của cả vector. SDK có sẵn type `SorobanAuthorizationEntries` — NHƯNG bản đã cài (js-xdr 4.0.0) có bug: instance `toXDR(value)` không nhận value (tự serialize chính nó) → "XDR Write Error: value is not array". `fromXDR` dùng tốt. Encode phải tự đóng khung: `uint32BE(count) ++ concat(entry.toXDR())`.
- Áp vào: `be/src/modules/sep45/entries.ts` + `fe/apps/web/src/features/wallet/lib/sep45-entries.ts` (2 bản đối xứng, cùng ghi chú).
- Mâu thuẫn skill? Không.

### 2026-07-24 · PHA 2.3 · Hạ tầng testnet đã deploy (dùng lại, đừng deploy trùng)

- `contracts/web-auth` (SEP-45): `CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST`
  (tx `ee36e934e337346f7187afe50f9fe45b847e020d3fe89255ec1fbcb1b7e1c074`).
- `contracts/smart-account` wasm upload: hash `87194f6100c81fd5c290ca6a28034bc9ef2f6e42b2f7e73eefae37d5ad3b02a8`
  (tx `78159d52cd6ecd655d782370bc624721ba8a713ebac5fedfa495c81835acbe16`).
- `contracts/origin-verifier` bản DEV (rpId=localhost, origins http://localhost:5173 + :4174):
  `CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N`.
  ⚠️ Bản dev CHỈ cho localhost — production deploy instance mới pin domain thật (3 origin web/APK/ext).
- SEP45 signing key dev: alias CLI `sep45-signing`, account `GB36727O4PD6ASHCJAREPS7XJZZL467LHETUTQYLFGJXFNZYRZQOBQBP` (friendbot funded; secret trong `be/.env`, KHÔNG commit).

### 2026-07-24 · PHA 4.2 · getEvents semantics (SDK 16 bản cài)

- Hỏi: cursor/pagination getEvents hoạt động thế nào?
- Nguồn: `be/node_modules/@stellar/stellar-sdk/lib/esm/rpc/api.d.ts` (`GetEventsRequest`/`GetEventsResponse`).
- Kết luận: 2 chế độ LOẠI TRỪ NHAU — `{startLedger, endLedger?}` HOẶC `{cursor}` (trộn là type error). Response: `events[]` (mỗi event có `id` DUY NHẤT toàn mạng — chính là khoá dedupe), `cursor` (trang kế), `latestLedger` + `oldestLedger` (RetentionState — phát hiện trôi cửa sổ ~7 ngày). Event: topic ScVal[] (parse `scValToNative`), value, txHash, ledger.
- Áp vào: `be/src/modules/indexer/infra/{indexer.service,rpc-source,checkpoint.schema}.ts`.
- Mâu thuẫn skill? Không — khớp fw-indexer-notify (checkpoint mỗi batch + dedupe id + cửa sổ 7 ngày).
