# Bằng chứng testnet — hạ tầng on-chain đã deploy

> ⚠️ **2026-07-27: MỌI contract ID/tx trong file này thuộc ĐỢT CŨ — đã BỎ.**
> Đợt hiện hành (redeploy sau vá B-SEC-1 + origin-verifier fail-closed):
> `docs/security/AUDIT-2026-07-25.md` §8 + bảng `docs/DEPLOY.md`.

> **Bảng contract ID hợp nhất (cái nào đang dùng): `docs/DEPLOY.md`.** File này giữ
> chi tiết tx hash + link stellar.expert theo từng pha (§PHA 2.3 · §PHA 5.2 · §AUDIT P0 ·
> §PHA 6 SEND). SAC native testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

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

## AUDIT P0 — Khôi phục ví CONTRACT thật: registry v2 xoay khoá BÊN TRONG smart account (2026-07-24)

Lỗ hổng: registry v1 (`CCPGVSLR…GT3V`) chỉ đổi `owner` trong storage CỦA NÓ — smart
account không hề biết, thiết bị mới không ký được gì (chi tiết RESEARCH-LOG). Thay bằng:

- **recovery-registry v2**: [`CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY`](https://stellar.expert/explorer/testnet/contract/CAN4LHSYB63UH3EKBPKYJ7RH4BRBU7Y7WMRILIQHM3WEJLTIKUVK27SY)
- **verifier-ed25519** (External signer không-WebAuthn cho e2e/khoá lạnh): `CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT`
- **smart-account wasm MỚI** (recovery hook + cooldown): hash `a67ea40eeca05bdd59b4f8bea87d40709415aac94978f8ef0630d9c919b92d25`

**E2e — chạy THẬT trên testnet 2026-07-24** (`RUN_TESTNET_E2E=1 bun test onchain.e2e`
→ **4 pass / 0 fail, 238s**; wallet = SMART ACCOUNT C…, ký `__check_auth` thật bằng
External(ed25519), digest = sha256(payload ++ scvVec(rule_ids).toXDR()) đúng công thức OZ):

| Bước | Chứng minh | Tx |
|---|---|---|
| deploy account 1+2 | ví contract mở bằng wasm hash + constructor (khoá CŨ) | [5d83767c](https://stellar.expert/explorer/testnet/tx/5d83767c42f74bd3c16866721b4fd38cf28cf30572a635bf738b35f5bd8e9355) · [562002bb](https://stellar.expert/explorer/testnet/tx/562002bbc2dfdc18ba45375b1a7a2e4c49a4bb418a473cfd5f0a31013ff4e1c8) |
| set_recovery_registry ×2 | KHOÁ CŨ ký qua `__check_auth` (crypto thật, không mock) | [f552f9c9](https://stellar.expert/explorer/testnet/tx/f552f9c91e4a28963aee1e31035118e58f92766fda1b8e78c37836ed3b84e8ec) · [6ca9bb92](https://stellar.expert/explorer/testnet/tx/6ca9bb92357db578871074ecd4697279e786ed83e14c7d34b1043deb4c1b9141) |
| register_wallet a1 | VÍ CONTRACT tự ký entry đăng ký registry | [fa76615b](https://stellar.expert/explorer/testnet/tx/fa76615bed6a3f3735ccada5d1fbea9bf37dac8881cdb8832d5ccef7233560e3) |
| initiate (g1, chở KHOÁ MỚI thật) | guardian bỏ phiếu cho ĐÚNG khoá mới (Signer trong entry đã ký) | [239d47f8](https://stellar.expert/explorer/testnet/tx/239d47f8496c69c31d53bd67831e727c5899b7b06548e4875ffb7f7541923d1a) |
| approve (g2 → đủ ngưỡng 2) | số phiếu ĐỌC thật từ chain | [f469d573](https://stellar.expert/explorer/testnet/tx/f469d573f756e2ab466683e70de77785d4a614b0c3b0bf53acbe9659bdde7de0) |
| chờ `timelock_remaining=0` → **finalize** | **registry gọi `recovery_rotate` — khoá đổi BÊN TRONG account** (invoker auth, zero auth entry người dùng) | [76d74ba8](https://stellar.expert/explorer/testnet/tx/76d74ba8a7ac922d07e94a8017984ea5f3698d65117f2e63f4f84a281b2bb306) |
| verify TỪ SMART ACCOUNT | `get_context_rule(0).signers` = [khoá MỚI], khoá cũ biến mất; `last_rotation` có dấu; địa chỉ ví KHÔNG đổi ✅ | (simulateRead) |
| cooldown 20s | NGAY sau xoay: cả khoá MỚI cũng bị chối `Error(Contract,#101)` CooldownActive ✅ | (simulate) |
| hết cooldown: **KHOÁ MỚI KÝ ĐƯỢC tx thật** | passkey/khoá mới sở hữu ví thật sự | [b675f53b](https://stellar.expert/explorer/testnet/tx/b675f53b263dfb42a23ba61dea3afc782adee5933d9058a146cc69761c523bc1) |
| khoá CŨ ký → CHẾT | `SIMULATION_FAILED` (UnauthorizedSigner) ✅ | (simulate) |
| veto khẩn a2: register → initiate → **cancel (VÍ tự ký)** | approve sau veto chết đúng mã; khoá gốc a2 còn sống | [6cd62791](https://stellar.expert/explorer/testnet/tx/6cd62791c2f9c40d3d3535c76dcdb5b2a996e1038008aeb187df5e99e9bf0f57) · [6a55f24c](https://stellar.expert/explorer/testnet/tx/6a55f24c35e680c752ed359ea55e5736075acb30b66b7419920fa554d71349cb) · [a098b872](https://stellar.expert/explorer/testnet/tx/a098b8720f6de500b738f0b760b3e5ac5e1e9096fdcdb799d9ad57210d37cbf8) |

## PHA 6 SEND — Gửi tiền từ ví HỢP ĐỒNG: đóng chuỗi hai-nửa (2026-07-24)

Gửi từ ví C… KHÔNG dùng payment op → invoke `transfer` trên SAC native
(`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`). auth `from` đi qua
`__check_auth` → verifier → **CHÍNH chuỗi passkey đã dựng**, giờ cho MỘT giao dịch tiền thật.

**E2e — chạy THẬT trên testnet 2026-07-24** (`RUN_TESTNET_E2E=1 bun test onchain.e2e`
→ **2 pass / 0 fail, 31s**; đi trọn pipeline intent: prepare[kiểm số dư]→confirm[policy allow]→
sign[ký entry ví bằng External/ed25519 qua __check_auth]→submit; verify người nhận NHẬN ĐỦ bằng
đọc `SAC.balance`):

| Bước | Chứng minh | Tx |
|---|---|---|
| deploy ví C… | smart account mở bằng wasm hash + constructor (khoá External) | [5fd69613](https://stellar.expert/explorer/testnet/tx/5fd696133224176310e84eeee09b798c87c53ae92762e0ac3c48058539b4b07d) |
| nạp XLM vào C… | G funder invoke SAC transfer(G→C) — chứng minh nhận-vào-C chạy | [f4dde2ad](https://stellar.expert/explorer/testnet/tx/f4dde2ad67b7f5979acc76b8eae477858d5550db2569d7238955540944aaf8ea) |
| **GỬI 1 XLM từ C…** | **passkey→__check_auth→verifier→transfer trong MỘT tx**; balance người nhận +1 XLM ĐÚNG số ✅ | [70bf7efb](https://stellar.expert/explorer/testnet/tx/70bf7efbe8db4137efe8a3accab38fff0be489b3f9eac57023742bb7f9254b18) |

Số dư thiếu → chặn TRƯỚC biometric (không tạo tx ký được) + vượt ngưỡng → awaiting_guardian →
guardian duyệt: phủ bằng integration test (`send-flow.test.ts`, DB thật + gateway fake, 5 ca).

## PASSKEY-ONCHAIN — Mắt xích cuối: WebAuthn secp256r1 KÝ TX THẬT (2026-07-24)

Mục SEND ở trên chạy `__check_auth` bằng khoá **ed25519** (External/verifier-ed25519) —
nhánh passkey WebAuthn thật là phần CHƯA chạm (B-23-2). Mục này đóng nốt: **toàn bộ
luồng sản phẩm chạy bằng passkey secp256r1 thật** (virtual authenticator Playwright,
ceremony `navigator.credentials` thật trong chromium) — KHÔNG còn ed25519 ở chỗ nào
của đường ký user.

**E2e — chạy THẬT trên testnet 2026-07-24** (`fe/apps/web/e2e/passkey-onchain.spec.ts`,
opt-in `RUN_TESTNET_E2E=1`, **1 pass, 41.6s**; lái ĐÚNG UI sản phẩm: `/setup` bấm
"Tạo ví của tôi" → `/wallet/send` nhập 1 XLM → "Xác nhận và gửi"; BE mock qua
`page.route` nhưng HAI CHÂN ON-CHAIN THẬT — build tx = simulate RPC thật, submit =
gửi mạng thật, mirror đúng `be/services/stellar`):

| Bước | Chứng minh | Bằng chứng |
|---|---|---|
| deploy ví bằng passkey | `kit.createWallet` autoSubmit — signer duy nhất = External(origin-verifier DEV, **key secp256r1 65B `0x04…` + credentialId suffix**) | [ví CBWLUXGF…E5A7](https://stellar.expert/explorer/testnet/contract/CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7) |
| nạp 3 XLM vào ví | G funder invoke SAC transfer(G→C) | [074a7fd2](https://stellar.expert/explorer/testnet/tx/074a7fd2f70a5e13d4a92cc65eee4e66c4ade269350a84022bb0ba2a406a4bba) |
| **GỬI 1 XLM ký bằng PASSKEY** | **secp256r1 → `__check_auth` → origin-verifier (rpIdHash pin + origin allow-list + UP/UV) → SAC transfer, MỘT tx, settled**; người nhận +1 XLM đúng số ✅ | [e83adb27](https://stellar.expert/explorer/testnet/tx/e83adb2733ce04ec753b875af89b0f80e8124b2172964c67e3e0f9362ebb5cd4) — verify độc lập RPC: SUCCESS, ledger 3777940, 15:43:11Z |
| signer đọc TỪ SMART ACCOUNT | `get_context_rule(0)`: đúng 1 signer External, verifier = `CCNS6O5H…` (webauthn), key 81B (65 pubkey + 16 credId), **KHÔNG phải verifier-ed25519** ✅ | assert trong spec, chạy sau khi settled |

Hai bug SẢN PHẨM thật tìm ra và vá trong quá trình đóng (chi tiết RESEARCH-LOG
§PASSKEY-ONCHAIN): (1) `signWalletEntries`/`sep45Login` không truyền `contextRuleIds`
— entry simulation mang placeholder `scvVoid` nên kit không tự đọc được, ký sẽ chết ở
runtime với MỌI backend thật; (2) placeholder entry ví của BE SEP-45 là `scvVec([])`
— kit `readAuthPayload` coi là AuthPayload hỏng và throw; đổi thành `scvVoid`.
Workaround test-env (KHÔNG phải code sản phẩm): shim credentials Playwright 1.61
thiếu `getPublicKey()` + `getAuthenticatorData()` trả nhầm attestationObject →
polyfill trong `e2e/support-passkey.ts` (trình duyệt thật có sẵn các API này).

## P0 CONSTRUCTOR-REGISTRY — ví sinh ra ĐÃ khôi phục được (2026-07-24)

**Lỗ hổng vá ở đây:** trước bản này KHÔNG đường sản phẩm nào gọi `set_recovery_registry`
(chỉ test gọi — grep toàn repo). Mọi ví tạo qua `/setup` deploy ra là ví **không khôi phục
được**: `recovery_rotate` chết mã 100 `RecoveryNotConfigured`. Toàn bộ máy khôi phục chạy
hoàn hảo on-chain nhưng không áp dụng cho ví thật nào — tính năng đầu bảng của sản phẩm
không tồn tại với người dùng.

**Cách vá:** registry cắm NGAY trong tx deploy qua mục đặt chỗ trong map `policies` của
constructor (`FwConstructorEntry::RecoveryRegistry(cooldown)`). Không tách thành tx thứ hai
vì tx đó fail = ví vĩnh viễn không cứu được, và không ai biết cho tới đúng lúc cần.
Vì sao phải lách qua `policies`: `smart-account-kit` khoá cứng constructor đúng hai tham số
(`kit/deploy-ops.js` → `SmartAccountClient.deploy`).

| Bước | Chứng minh | Bằng chứng |
|---|---|---|
| upload wasm smart-account bản có hook | hash `d86d927e…572f` (bản cũ `a67ea40e…` BỎ) | [ddc5924b](https://stellar.expert/explorer/testnet/tx/ddc5924bf7d9e11e1d3ddccab036631f1b39023697a972eabdbf2ad1cbbb5117) |
| deploy registry v2.1 (thêm `veto_registry_change`) | `CCZWMNT6…2NLL` (bản `CAN4LHSY…27SY` BỎ) | [75336a4f](https://stellar.expert/explorer/testnet/tx/75336a4ff650e55375c0a9984f1396f4b39f002fadc5f758d12998713771b4b3) |
| **deploy ví có mục đặt chỗ — MỘT tx** | tx thành công đã tự là bằng chứng tách đúng: mục lọt sang OZ thì `add_context_rule` gọi `install()` lên registry và deploy CHẾT | [bc3f7261](https://stellar.expert/explorer/testnet/tx/bc3f72611e42b85bf8273c11709b02fb7d6b8a0ed318b52d729464fc2cb22bd8) — ví [CAU26NTA…XCWL](https://stellar.expert/explorer/testnet/contract/CAU26NTA7ZVN6TRPMZY6V6ZPMONR5YOWNEJI5YUVBSAO5JWRU55RXCWL) |
| **đọc NGƯỢC từ ví** | `get_recovery_registry()` = `("CCZWMNT6…2NLL", 86400)` ✅ — registry nằm trong storage CỦA VÍ, không phải niềm tin ở FE | simulate RPC thật |
| **CỔNG CHỐNG HỒI QUY** | `get_context_rule(0)`: `signers.len = 1` · `policies.len = 0` ✅ — ví chủ ĐÚNG MỘT signer, guardian không bao giờ là signer ở đây | simulate RPC thật |

Ký bằng gì: deploy ký bằng **ed25519 ví phí** (envelope) — đây là tx deploy, chưa có chữ ký
người dùng nào. Signer cài vào ví trong lần chạy này là External(verifier-ed25519) cho gọn;
đường passkey secp256r1 đã chứng minh riêng ở §PASSKEY-ONCHAIN và dùng chung đúng constructor.

⚠️ **Ví testnet tạo TRƯỚC 2026-07-24 (wasm `a67ea40e…`) không khôi phục được** — không có
đường vá vì `set_recovery_registry` nay chặn ghi đè và ví cũ chưa từng được cắm. Tạo lại ví.

## MULTI-DEVICE — Ba người, ba máy, ba passkey độc lập (2026-07-25)

Claim mạnh nhất của sản phẩm khi thi: **"người nhà bỏ phiếu bằng vân tay TRÊN MÁY CỦA
CHÍNH HỌ"**. Trước phiên này nó chỉ được chứng minh gián tiếp (unit test + đọc ví tay).
Giờ nó đi qua ĐÚNG UI sản phẩm, trên testnet thật.

Cách mô phỏng nhiều máy mà không cần phần cứng: `browserContext.credentials` scope theo
**BrowserContext**, nên mỗi context = một máy ảo với authenticator riêng, passkey riêng,
storage riêng. Ba context ⇒ ba hợp đồng KHÁC NHAU là bằng chứng chúng không dùng chung
passkey nào.

| Vai | Hợp đồng | Tạo qua màn |
|---|---|---|
| chủ ví | `CBFHCYQQDJ5FDQB5MVYBB7TUBPU65ZR4SUBS2EVPSVRRSZVETPMPBOW5` | `/setup` |
| người thân 1 | `CBIWMIHXK2RLZB2GC3EJRLN4Z5PVDR7PY75XIZIXEUDF6ATYJXSGDXOA` | `/guardian/accept` |
| người thân 2 | `CAYSOPMNPRLJVF7K6ZBJLW4HRTUB2O3A4234TPBGP4M6WGK5AVIG2WSL` | `/guardian/accept` |

| Bước | Tx | Ký bằng gì |
|---|---|---|
| `register_wallet` (chủ ví bật bảo vệ ở `/setup/review`) | `fe87434201fa494e24c92c472f0072e1477b6b172d1128ba074c0b36d9eb9b19` | **passkey chủ ví** (WebAuthn secp256r1, virtual authenticator máy 1) — envelope do ví phí ký, ví phí KHÔNG ký hộ người dùng |

Verify ĐỘC LẬP (không tin lời test — hỏi thẳng Horizon):

```bash
curl -s https://horizon-testnet.stellar.org/transactions/fe87434201fa494e24c92c472f0072e1477b6b172d1128ba074c0b36d9eb9b19 \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['successful'], d['ledger'], d['created_at'])"
# → True 3785310 2026-07-25T01:58:31Z
```

https://stellar.expert/explorer/testnet/tx/fe87434201fa494e24c92c472f0072e1477b6b172d1128ba074c0b36d9eb9b19

### Đọc lại TỪ CHAIN sau khi đăng ký (simulate, không phải mirror)

- `get_wallet_config(ví chủ)` → đúng 2 người bảo hộ trên, `threshold = 2`.
- `get_recovery_registry(ví chủ)` → `CAFU4CZN…FMCO` (registry cắm sẵn trong constructor).

### CỔNG CHỐNG HỒI QUY — thứ phải xanh mãi mãi

`get_context_rule(0)` của **ví CHỦ** = **đúng 1 signer**, và signer đó là verifier
WebAuthn `CCNS6O5H…C2O4N`.

Vì sao đây là cổng quan trọng nhất của cả dự án: nếu con số này thành 3 thì mô hình đã bị
kéo về multisig, và theo `do_check_auth` của OZ, **một** signer trong rule không policy
authorize được TOÀN BỘ context — tức mỗi người bảo hộ tự mình rút sạch ví được. Người bảo
hộ KHÔNG BAO GIỜ là signer trên ví chủ; họ bỏ phiếu ở registry. Mỗi ví người thân cũng
đúng 1 signer — của chính họ.

Chạy lại: `RUN_TESTNET_E2E=1 pnpm --filter @repo/web exec playwright test e2e/multi-device
--project=chromium` (cần preview `:4174`). Kết quả máy: `docs/evidence/multi-device-latest.json`.

---

## LÔ 3 — HẠN MỨC ON-CHAIN (spending-limit policy, 2026-07-29)

Chứng minh "backend sập cũng không ai vượt được hạn mức": policy contract (vỏ mỏng
quanh OZ `stellar_accounts::policies::spending_limit` 0.7.2) gắn vào ví hợp đồng qua
`add_context_rule(CallContract(SAC))` và chối chi tiêu ngay trong `__check_auth`.

| Gì | Giá trị | Link |
|---|---|---|
| Policy contract `spending-limit-policy` (vỏ OZ) | `CABZ6H4DPPTUGAAN7TI74AWMMWF54IHHDNUXXN2GDZZVTMFDWWJLXBK2` | [contract](https://stellar.expert/explorer/testnet/contract/CABZ6H4DPPTUGAAN7TI74AWMMWF54IHHDNUXXN2GDZZVTMFDWWJLXBK2) |
| Wasm hash (build local = deploy) | `7ce822b190e41201b0a4e6ee80c509b846fffe837584b435ba61efafe6332248` | — |
| Ví bằng chứng (deploy từ wasm smart-account `2c19ee49…`) | `CDENRYUMJFE66INGJFBMPCOSU6U3TJV2FZCM2LC4JILKFYFOR2BWDEMW` | [contract](https://stellar.expert/explorer/testnet/contract/CDENRYUMJFE66INGJFBMPCOSU6U3TJV2FZCM2LC4JILKFYFOR2BWDEMW) |
| Cấu hình policy | hạn mức **50 XLM** / cửa sổ **60 ledger** (~5 phút) | — |

Chạy lại: `RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/spending-limit.e2e`
(cần `FEE_WALLET_SECRET` + `CONTRACT_ID_SAC_NATIVE`).

### 4 ca bằng chứng (+ 1 ca đo nợ)

| # | Ca | Kỳ vọng | Kết quả | tx / ledger |
|---|---|---|---|---|
| gắn | `add_context_rule(CallContract(SAC))` chở policy (ký rule 0) | rule 1 có policy | ✅ `get_context_rule(1).policies = [CABZ…BK2]` | [tx](https://stellar.expert/explorer/testnet/tx/b9c4158eed081402808ad3a2e13dff7044ef7b36d77b417be8fe06c0003699c4) |
| 1 | Gửi **10 XLM** dưới hạn mức, ký rule 1 | Pass, người nhận nhận đủ | ✅ pass | [tx](https://stellar.expert/explorer/testnet/tx/a357db938fbd09daa48f0a64e2cbdc69f90bdb5c6096a90da705d20858819a04) |
| 2 | Gửi **60 XLM** vượt một lệnh | **Bị chối on-chain** | ✅ `Error(Auth, InvalidAction)` — enforce panic #3221 trong `__check_auth` | @ledger 3853678 |
| 3 | Cộng dồn: +20 XLM pass (tổng 30) rồi +25 XLM (tổng sẽ 55 > 50) | Lệnh thứ hai **bị chối** | ✅ 3a pass; 3b `Error(Auth, InvalidAction)` #3221 | [3a](https://stellar.expert/explorer/testnet/tx/785e3a1c4bbe81b08f60b442547efb221db082a0a4178ab0ab8e9ff12dac199c) · @ledger 3853680 |
| 4 | Chờ qua cửa sổ (~60 ledger), gửi lại **25 XLM** | Pass trở lại (entry cũ evict) | ✅ pass | [tx](https://stellar.expert/explorer/testnet/tx/919342e1e502f577940b3cbaa1514cbd464104668960a80ca040ffc7b46c494a) |
| 5 ⚠️ | Cùng **60 XLM** nhưng ký **rule 0** (Default, không policy) | — (đo nợ) | ⚠️ **PASS** — policy không chạy trên rule Default | [tx](https://stellar.expert/explorer/testnet/tx/37940d9303f7b885145c361d6242e9da9fa938ee4428fff70dcc8c1d4af1f9a1) |

State on-chain sau ca 4 (đọc thật): `get_spending_limit_data(1, ví)` =
`{spending_limit: 500000000, period_ledgers: 60, cached_total_spent: 250000000}`.

### ~~⚠️ NỢ TRUNG THỰC (ca 5) — hạn mức ràng buộc THEO ĐƯỜNG KÝ, chưa tuyệt đối~~ → **ĐÃ VÁ 2026-07-29 (LÔ 2.5)**

~~OZ `spending_limit::install` CHỈ nhận rule kiểu `CallContract(token)` (mã 3227) — KHÔNG
gắn được vào rule 0 (Default "owner")… nợ, không làm trong LÔ 3.~~

**Vá:** vỏ policy (`contracts/spending-limit-policy`) thêm đường install riêng cho rule
Default — `DefaultInstallParams {spending_limit, period_ledgers, token}` chở token TƯỜNG
MINH (OZ không cho vì rule Default không nói token). `enforce` trên rule Default: gọi đúng
token đo → OZ đo nguyên bản (vượt = 3221; `approve`/fn khác trên token = 3223, đóng đường
lách allowance); context khác (quản trị ví, contract ngoài) → cho qua — sub-invocation
không thoát được vì Soroban đưa MỌI context của cây auth vào `__check_auth`. Bản
Default-capable deploy từ release `v0.1.1`, **StellarExpert verified**.

## LÔ 2.5 — RULE DEFAULT ĐÃ VÁ (2026-07-29)

Chạy lại: `RUN_TESTNET_E2E=1 bun test src/modules/intents/features/send-flow/spending-limit-default.e2e`

| Gì | Giá trị | Link |
|---|---|---|
| Policy Default-capable (release v0.1.1, wasm `13fab007…`, ✅ verified) | `CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK` | [contract](https://stellar.expert/explorer/testnet/contract/CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK) |
| Ví bằng chứng (wasm `c1b28d42…` — bản artifact v0.1.0) | `CCMZOTRPZKEFMKBCKBK72AX2WIWZX77VLGVIXTWP626XG5UFFPKYJT7U` | [contract](https://stellar.expert/explorer/testnet/contract/CCMZOTRPZKEFMKBCKBK72AX2WIWZX77VLGVIXTWP626XG5UFFPKYJT7U) · [deploy](https://stellar.expert/explorer/testnet/tx/4eee54864ac544e4da8f79ccdca147fbbd36206a4f252c8e6f794ed37b4763ce) · [fund](https://stellar.expert/explorer/testnet/tx/f1b1ae6b0a09158372851a48a5c7e51da9c3db7e06274f227fffb5b5c2191197) |
| Cấu hình | hạn mức **50 XLM** / **60 ledger**, token đo = SAC native | — |

| # | Ca | Kỳ vọng | Kết quả | tx / ledger |
|---|---|---|---|---|
| 6 | `add_policy(rule 0, DefaultInstallParams{50 XLM, 60 ledger, SAC})` ký rule 0 | rule 0 chở policy | ✅ `get_context_rule(0).policies=[CCIN…FJZK]` · `get_metered_token(0)=SAC` | [tx](https://stellar.expert/explorer/testnet/tx/7ed6d24db28d80d8c0e77950afaab4b5b575e7baeba5eb901d1b9f007482d3ce) |
| 7 | **10 XLM** ký RULE 0 | pass và BỊ ĐO | ✅ pass, `cached_total_spent=100000000` (đọc on-chain) | [tx](https://stellar.expert/explorer/testnet/tx/886b56531ea227311229288ffdae8839954a1aedd842feb8a66422b9211e906c) |
| 8 | **60 XLM** ký RULE 0 — chính đường bypass ca 5 | **BỊ CHỐI** | ✅ `Error(Auth, InvalidAction)` — enforce panic **#3221** trong `__check_auth` (simulation reject, không submit — cùng khuôn ca 2/3) | @ledger ≈ 3855740 (2026-07-29 ~03:57 UTC) |
| 9 | Admin op (`add_context_rule`) ký RULE 0 sau khi gắn policy | pass — policy không khoá quản trị | ✅ pass, tổng chi KHÔNG đổi (100000000) | [tx](https://stellar.expert/explorer/testnet/tx/d62c90deada173659f806e6906c925222458284afcb4fc2240f3f9aeefd0c54d) |

⇒ Trên ví đã `add_policy(rule 0)`: **không còn đường ký nào vượt hạn mức** — rule 1
(CallContract) lẫn rule 0 (Default) đều bị đo cùng một sổ. Phạm vi trung thực còn lại:
(a) hạn mức đo MỘT token (thiết kế OZ) — ví giữ token khác ngoài SAC thì token đó không
bị đo; (b) ví TẠO TRƯỚC 29/07 (vd `CD5QX3…`) chưa gắn policy vào rule 0 — gắn cần chủ ví
ký `add_policy` qua app (nợ wiring FE, chưa làm ở lô này).
