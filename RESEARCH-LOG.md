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

### 2026-07-24 · PHA 6 SEND · Gửi tiền từ ví HỢP ĐỒNG = invoke SAC transfer (không payment op)

- Hỏi: gửi XLM TỪ ví C… (smart account) làm thế nào? Payment op có được không?
- Nguồn: docs Stellar ("payment operations cannot have contract addresses as source or
  destination") + `.d.ts`/runtime `@stellar/stellar-sdk` bản cài + `stellar contract id asset`.
- Kết luận:
  - Ví C… KHÔNG dùng payment op. Gửi = **invoke `transfer(from,to,amount)` trên SAC** (Stellar
    Asset Contract — built-in mỗi asset một instance). from = địa chỉ ví C…; auth `from.require_auth()`
    đi qua `__check_auth` của smart account → verifier passkey (CHÍNH chuỗi đã dựng ở audit P0).
  - **SAC native testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`**
    (`stellar contract id asset --asset native --network testnet`). Mainnet id khác — lấy lại khi lên.
  - `amount` = i128: `nativeToScVal(bigint, {type:"i128"})` (runtime xác nhận → scvI128). Đơn vị stroops.
  - Số dư đọc = simulate `balance(id: Address)` trên SAC (view, không tốn phí) → i128 native.
  - Nhận tiền vào C… bình thường ở tầng giao thức → màn receive (địa chỉ) là đủ, chỉ chiều GỬI cần invoke.
  - Transfer SAC KHÔNG có field memo → sàn cần memo phải muxed address (chưa cần cho gia đình — TODO).
  - Trustline: XLM không cần; asset khác (USDC…) ví C… cần trustline trước → phase này CHỈ XLM.
- Áp vào: `be/src/modules/intents/features/send-flow/*` (build transfer qua `services/stellar`,
  đi TRỌN pipeline intent PHA 3: draft→validating→review→policy_gate→awaiting_signature|guardian→
  submitting→settled). FE ký entry ví bằng passkey (reuse `signRecoveryEntries` → đổi tên chung).
- Mâu thuẫn skill? Không — khớp vi-backend-pipeline §1-3 (pipeline intent) + stellar-security K2
  (challenge dẫn xuất từ tx đã simulate, kit tự làm).

### 2026-07-24 · AUDIT P0 · Registry v1 KHÔNG xoay signer smart account — lỗ hổng THẬT, đã thay bằng v2

- Hỏi: `finalize_recovery` của `CCPGVSLR…GT3V` có xoay passkey bên trong smart account không?
- Bằng chứng (3 đường, không đoán):
  1. grep `add_signer|remove_signer|rotate` toàn contracts/ + be/src/: KHÔNG có đường recovery nào
     đụng signer; chỉ `batch_add_signer` tự-ký (nối vỏ) trong smart-account.
  2. grep chéo contract ID: registry chỉ nằm trong be/.env + test; hai contract KHÔNG gọi nhau;
     source registry v1 không có trong repo (spike cũ).
  3. Interface v1 (RESEARCH-LOG dưới): `initiate_recovery(new_owner_candidate: Address)` — Address
     KHÔNG CHỞ NỔI vật liệu passkey `External(verifier, key_bytes)` → v1 không sửa bằng wiring được.
     E2e 5.2 verify bằng `get_wallet_config` của registry, wallet là account G… classic — chưa từng
     có smart account tham gia.
- Fix (phương án B, hiện thực bằng recovery hook): smart-account thêm `recovery_rotate` (registry là
  DIRECT INVOKER → `require_auth(registry)` tự thoả — invoker auth chuẩn Soroban, KHÔNG cần craft
  delegated entry cho đường xoay) + `set_recovery_registry` (tự-ký) + cooldown chặn `__check_auth`
  sau xoay (mã lỗi riêng 100/101). Registry v2 (`contracts/recovery-registry`) giữ nguyên tên hàm +
  error codes 1..16 + event topics v1; `initiate_recovery` nhận `Signer` OZ; finalize gọi
  `recovery_rotate` rồi mới Finalized. Test 10/10 gồm: ký thật ed25519 qua `__check_auth`
  (digest = sha256(payload ++ rule_ids.to_xdr()) — đúng công thức OZ do_check_auth), khoá cũ bị
  chối sau xoay, cooldown chối cả khoá mới, finalize với `set_auths(&[])` (zero auth entry).
- Deploy testnet 2026-07-24:
  - **recovery-registry v2: `CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY`** (thay
    `CCPGVSLR…GT3V` trong env — v1 bỏ, không dùng nữa)
  - verifier-ed25519: `CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT`
  - smart-account wasm MỚI (có recovery hook): hash `a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25`
    (hash cũ `87194f61…` là bản KHÔNG có hook — FE env phải trỏ hash mới)
- Mâu thuẫn skill? Không — skill passkey §0 cảnh báo delegated-signer-phải-craft-entry vẫn đúng cho
  đường KHÁC (client ký bằng delegated signer); đường xoay của ta né hẳn nó bằng invoker auth.

### 2026-07-24 · PHA 5.2 · Interface recovery contract testnet (đọc TỪ CHAIN — bản ĐẦY ĐỦ)

- Hỏi: contract recovery `CCPGVSLR…GT3V` (spike cũ, ngoài repo) có hàm gì?
- Nguồn: `stellar contract info interface --id CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V --network testnet` (spec thật trên chain, đọc lại trọn vẹn 2026-07-24 phiên 5.2).
- Kết luận (12 hàm):
  - Ghi: `register_wallet(owner, guardians Vec<Address>, threshold u32, timelock_secs u64)` ·
    `add_guardian(wallet, new_guardian)` · `remove_guardian(wallet, guardian)` ·
    `initiate_recovery(wallet, new_owner_candidate, initiator)` (initiator là arg riêng — guardian ký) ·
    `approve_recovery(wallet, guardian)` · `finalize_recovery(wallet) -> Address` (KHÔNG có arg actor
    → không đòi auth người dùng, ai crank cũng được sau timelock) · `cancel_recovery(wallet, owner)` (= veto).
  - Đọc: `is_registered(wallet) -> bool` · `get_wallet_config(wallet) -> WalletConfig{guardians, owner, threshold, timelock_secs}` ·
    `get_recovery_status(wallet) -> RecoveryRequest{approvals Vec<Address>, new_owner, started_at u64, status}` ·
    `timelock_remaining(wallet) -> u64`.
  - `RecoveryStatus`: Pending | Approved | TimelockDone | Finalized | Cancelled.
  - Error enum 1..16: AlreadyRegistered, NotRegistered, InvalidThreshold, TooFewGuardians, TooManyGuardians,
    NotAGuardian, RecoveryInProgress, NoActiveRecovery, ThresholdNotMet, TimelockNotElapsed, AlreadyApproved,
    RecoveryCancelled, AlreadyFinalized, GuardianExists, GuardianNotFound, DuplicateGuardian.
  - Mô hình khoá: "wallet" = địa chỉ đăng ký lúc `register_wallet` (chính là owner ban đầu) — khớp
    `wallets.stellarAddress` trong DB. `owner` hiện tại đọc từ `get_wallet_config` (đổi sau finalize).
- Áp vào: PHA 5.2 route recovery (`/recovery/register|initiate|approve|veto|finalize|submit`) — build invoke qua `services/stellar`, FE ký auth entry, BE validate entry + fee-wallet ký envelope + submit.
- Mâu thuẫn skill? Không.

## PASSKEY-ONCHAIN — mổ chuỗi lỗi khi đóng mắt xích passkey (2026-07-24)

- Hỏi: vì sao `kit.createWallet`/`signAuthEntry` (smart-account-kit 0.4.2) chết khi chạy
  bằng virtual authenticator Playwright 1.61, trong khi cargo test + BE e2e (ed25519) xanh?
- Nguồn: chạy THẬT + đọc bundle kit (`dist/utils.js`, `kit/webauthn-ops.js`,
  `kit/auth-payload.js`, `kit/deploy-ops.js`) + bundle Playwright (`coreBundle.js`)
  + probe `canonicalize_key` trên verifier DEV deployed (simulate 3 độ dài key).
- Kết luận — BA tầng lỗi độc lập, bóc lần lượt:
  1. **Shim credentials của Playwright 1.61** (JS-level, KHÔNG phải CDP authenticator):
     `AuthenticatorAttestationResponse.getPublicKey()` không có, và
     `getAuthenticatorData()` trả NHẦM cả attestationObject CBOR (`{fmt,attStmt,authData}`).
     Kit vì thế rơi vào parser fallback offset-cứng trên buffer sai → key rác 17B →
     constructor deploy chết `Error(Contract, #3119) KeyDataInvalid` (OZ webauthn:
     `extract_from_bytes(0..65)` fail). Vá TRONG TEST: `e2e/support-passkey.ts` polyfill
     `getPublicKey` (bóc CBOR "authData" + tìm nhãn toạ độ x/y `0x21/0x22 0x58 0x20`
     trong vùng COSE → SPKI DER). Trình duyệt thật CÓ getPublicKey — không đụng sản phẩm.
  2. **Bug SẢN PHẨM — thiếu `contextRuleIds`**: entry từ simulation mang signature
     placeholder `scvVoid`; `readAuthPayload(scvVoid)` trả payload rỗng nên
     `kit.signAuthEntry` không có rule ids → throw "contextRuleIds are required".
     `signWalletEntries` + `sep45Login` chưa truyền → CHẾT với MỌI backend thật
     (BE e2e không lộ vì test BE tự dựng payload map với rule_ids [0]).
     Vá: `DEFAULT_CONTEXT_RULE_IDS = [0]` (mức A một rule chủ ví — đúng công thức
     digest đã chứng minh on-chain ở audit P0; mức B resolve động theo rule người ký).
  3. **Bug SẢN PHẨM — placeholder sai loại**: BE SEP-45 dựng entry ví với
     `scvVec([])`; `readAuthPayload` coi scvVec là AuthPayload hỏng → throw ngay cả
     khi đã truyền rule ids. Vá: `scvVoid()` (khớp chuẩn simulation RPC).
- Kiểm chứng shim phía KÝ (đọc coreBundle `_handleGet`): chữ ký = `crypto.sign` DER ✓
  (khớp `compactSignature` kit), authData assertion đúng format, flags `1|4` = UP+UV ✓,
  clientDataJSON có origin thật của trang ✓ → không cần polyfill cho đường ký.
- Kết quả sau 3 vá: e2e `passkey-onchain.spec.ts` PASS — deploy passkey thật + gửi
  1 XLM ký secp256r1 settled (tx `e83adb27…`, TESTNET.md §PASSKEY-ONCHAIN).
- Phát hiện kèm: `signAuthEntry` tìm signer bằng `get_context_rule` TỪ CHAIN →
  ví CHƯA deploy không ký được (luồng /passkey createCta cũ là dead-end; spec
  passkey-login skip có chủ đích, createCta nên trỏ về /setup).
- Mâu thuẫn skill? Không — fw-passkey-auth đúng; bổ sung được chi tiết kit 0.4.2.
