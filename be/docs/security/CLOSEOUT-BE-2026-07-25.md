# Closeout audit BE — 2026-07-25 (phiên 3, chỉ `be/`)

Nối tiếp `AUDIT-2026-07-25.md` + hai phiên closeout trước. **Không đụng `fe/`, không
đụng `contracts/`.** Ba mức bằng chứng ghi rõ ở từng mục: **[chạy thật]** trên
DB/HTTP thật · **[hermetic]** unit/mock · **[chưa làm được]**.

Branch: `sec/be-audit-hardening` (6 commit). Xem mục 9 về lý do không dùng
`sec/be-audit-2026-07-25`.

---

## 1 · Bảng phát hiện

| Mức | Phát hiện | Commit | Test hồi quy + dòng đỏ trên bản cũ | Bằng chứng |
|---|---|---|---|---|
| 🔴 | `DATABASE_URL` là role **owner + superuser** → tầng REVOKE audit_log (0009) là trang trí | `d59dc54` | `audit-runtime-role.integration.test.ts` §1.1 — 4 ca đỏ: `app KHÔNG nối bằng superuser` · `KHÔNG sở hữu audit_log` · `KHÔNG có TRUNCATE/DELETE/UPDATE` · `KHÔNG chạy được DDL` (7 pass, 4 fail) | [chạy thật] |
| 🔴 | JWT ví thu hồi được **trên giấy** — `verifyWalletJwtCurrent` 0 caller, FE vẫn gửi Bearer mọi request | `458f775` | `wallet-session.test.ts` — 3 ca đỏ khi gỡ mount (5 pass, 3 fail) | [chạy thật] |
| 🔴 | SEP-45 **không kiểm footprint** → entry `transfer` lọt check cấu trúc thì simulate OK và ta ký hộ | `982cbe3` | `service.test.ts` — `simulate THÀNH CÔNG nhưng footprint ghi balance` (6 pass, 1 fail) + 8 ca hermetic | [hermetic] |
| 🔴 | Rate-limit theo IP **giả mạo được** trên Caddy (proxy repo tự khai là ƯU TIÊN) | `d49121a` | — (đọc code + 2 file cấu hình proxy; xem "còn nợ") | [chạy thật: đọc cấu hình] |
| 🟠 | Pool Postgres **không có `statement_timeout`** → 1 query kẹt giữ connection vĩnh viễn | `d49121a` | — | [chạy thật: đọc cấu hình] |
| 🟠 | Better Auth `secondaryStorage` chạy trên connection **retry vô hạn** → Dragonfly chớp = request treo | `d49121a` | — | [chạy thật: đọc cấu hình] |
| 🟠 | Ngân sách tắt máy **đảo ngược**: child 15s > supervisor 8s < Docker 15s | `d49121a` | — | [chạy thật: đọc cấu hình] |
| 🟠 | **Không có pre-commit quét secret** dù rules khẳng định có | `01ef15c` | Repo nháp: stage secret giả → `leaks found: 1`, commit bị chặn | [chạy thật] |
| 🟠 | Nhật ký ví **không đọc được quá 100 dòng** — không con trỏ | `d49121a` | `list-audit/handler.test.ts` — 3 ca phân trang (bản cũ: `seen.length === 2`) | [chạy thật] |
| 🟠 | **Lọc sau LIMIT** ở 3 endpoint → `?status=` trả rỗng sai | `d49121a` | — (sửa vào SQL; xem "còn nợ") | [chạy thật: đọc code] |
| 🟡 | Không có endpoint số dư → xem số dư phải gọi endpoint **đổi trạng thái** | `d49121a` | Có trong ma trận BOLA ngay | [chạy thật] |
| ✅ | BOLA — 26 route nhận ID, **0 rò** | `c79d8a6` | `authz-matrix.integration.test.ts` 31 ca; gỡ vế owner ở `guardians.repository.ts:19` → 1 fail | [chạy thật] |

**Test: 285 → 343 pass, 0 fail** (+58). `bun run validate` xanh.

---

## 2 · §1 — ba lỗ "đã khai đóng"

### 1.1 `DATABASE_URL` — ĐÃ SỐNG. Role hiện tại: **`app_rt`**

Đo trước khi vá, bằng SQL thật, không đọc bằng mắt:

```
SELECT current_user, usesuper                                  -> app, t
SELECT has_table_privilege(current_user,'audit_log','TRUNCATE') -> t
SELECT has_table_privilege(current_user,'audit_log','DELETE')   -> t
```

Owner `DROP TRIGGER` rồi `TRUNCATE` trong hai câu lệnh ⇒ **cả migration 0009 vô
nghĩa trên production**, trong khi test cũ vẫn xanh vì nó chạy bằng chính owner.

Sau vá: `DATABASE_URL` → **`app_rt`** (thành viên `app_runtime`, `usesuper=f`, không
sở hữu bảng). `DATABASE_URL_OWNER` giữ credential owner, **chỉ** migrate +
provision đọc, process app không thấy. `scripts/provision-runtime-role.ts` tự
FAIL nếu role vẫn xoá được audit_log hoặc trùng owner.

**Test chạy bằng role runtime** — đây là điểm mấu chốt §1.1 đòi: `test-support/pg.ts`
dùng chung `client` của `@/db`, nên đổi `DATABASE_URL` là cả suite đổi theo. Toàn bộ
276 ca cũ chạy được dưới quyền hạn chế ⇒ vá không làm chết đường ghi.

Bằng chứng phụ, không dàn dựng: test phân trang **không tự dọn được** dòng audit —
`PostgresError: audit_log is append-only (A7): DELETE blocked`.

### 1.2 `jwt_version` — ĐÃ SỐNG, nhưng phát hiện quan trọng hơn dự kiến

`grep` mọi route đọc JWT: **không route nào** kiểm `ver`, vì **không route nào tiêu
thụ JWT ví**. `verifyWalletJwtCurrent` là code chết (chú thích của chính nó nói vậy).

Điều phiên trước không thấy: **FE gửi token đó thật**, `Authorization: Bearer` trên
mọi request (`fe/…/lib/wallet-token.ts:26`). Đo trên server đang chạy:

```
cookie only                       -> 200 {"data":[]}
cookie + JWT ví giả mạo (Bearer)  -> 200 {"data":[]}
```

Better Auth thấy Bearer lạ thì lặng lẽ rơi về cookie ⇒ token đã thu hồi vẫn đi lọt
khắp nơi, và FE vẫn tưởng "đang đăng nhập ví" vì nó chỉ tự decode `exp`.

Vá: `walletSession` middleware **dùng chung** trên `/api/*` (không rải từng route —
rải thì route thêm sau bỏ sót). Token ví đã thu hồi → **401 `WALLET_SESSION_REVOKED`**.
Cửa `/api/sep45/challenge`, `/token`, `/health` **được miễn**: không miễn thì đúng
người vừa mất thiết bị bị khoá ngoài, không đăng nhập lại được. `GET /api/sep45/session`
là cửa đọc để quan sát.

`recovery finalize` **có** tăng `jwt_version` (`onchain-actions/service.ts:239-240`),
đường này thật sự được gọi.

**Giới hạn thiết kế — nói thẳng:** thu hồi dựa DB. Kẻ ghi DB tuỳ ý **reset được**
`jwt_version` và hồi sinh token. **Không vượt bất biến 1.** Không có đường buộc vào
on-chain, và tôi không giả vờ có. Custody vẫn nằm trên chuỗi — đây là tầng phiên,
không phải tầng tiền.

### 1.3 lefthook — ĐÃ SỐNG (tệ hơn mô tả)

Không chỉ root `lefthook.yml` là bản ví dụ comment 100%: **`.git/hooks/` chỉ có
`prepare-commit-msg`** — không có pre-commit nào. `be/lefthook.yml` có gitleaks thật
nhưng không ai cài, và git root là gốc monorepo nên file gốc mới quyết định.

Vá + kiểm bằng repo nháp: `WRN leaks found: 1`, commit bị chặn, `git log` chỉ còn
commit init. Rule sửa lại kèm **cách tự kiểm** (`ls .git/hooks/pre-commit`) thay vì
bảo người đọc tin file cấu hình — tin file cấu hình chính là cái đã sai.

---

## 3 · §2 CVE — cả hai lỗ đã đóng SẴN, không phải do phiên này

- **`drizzle-orm`**: `0.45.2` (đã vá CVE-2026-39356; bản dính là `<= 0.45.1`). **Không
  cần bump.** Rà đường gọi: `sql.identifier` **0 hit**, `sql.raw` **0 hit**, `.as()`
  **0 hit**; **13/13** `orderBy` là column object tĩnh, không hit nào nhận input người
  dùng. Không có allowlist nào cần thêm vì **không có identifier động nào tồn tại**.
- **`bun:sql`**: **KHÔNG dùng**. Driver là `postgres` (postgres.js) `3.4.9` →
  oven-sh/bun#30646 không áp dụng. Đã ghi comment cảnh báo ở `src/db/index.ts` để
  phiên sau không đổi sang `Bun.SQL` mà không đọc issue.
- `hono` 4.12.28 (mới), `@stellar/stellar-sdk` 16.0.1, `zod` 4.4.3.
- `bun audit --audit-level=high`: **sạch**, không finding nào.

---

## 4 · §3 BOLA — con số

| | |
|---|---|
| Route đã mount | 45 |
| Route nhận ID object | **26** |
| Có ownership check dựa DB | **21** |
| Public có chủ đích, không ownership | **5** |
| **FAIL test hai tài khoản** | **0** |
| Lấy vai trò từ claim client | **0** |

Bảng đầy đủ: `AUTHZ-MATRIX.md`.

Điều đáng ghi: bản đầu của test đòi "không được 200" và làm **6 route đỏ**. Đo lại
thì cả 6 trả `{"data":[]}` cho người lạ trong khi chủ ví nhận đúng dòng — phòng thủ
CÓ chạy, chỉ khác hình dạng (scope trong SQL thay vì 403). **Sửa test, không sửa
code.** Đây là chỗ dễ khai sai thành "6 lỗ BOLA đã vá".

Test có **2 ca chứng minh ngược** (chủ ví đọc được), nếu không thì fixture chết cũng
cho `{"data":[]}` và cả ma trận xanh vì không có gì để rò.

---

## 5 · §4 SEP-45 footprint — ĐÃ CÀI (lần thứ ba mới xong)

`assertNonceOnlyFootprint` + `footprintAllowedAddresses`, gọi ở `service.ts` **sau**
simulate, **trước** phát JWT. `read_write` chỉ được chứa `contract_data` key
`ledger_key_nonce` của Client/Server/(tuỳ chọn) Client Domain Account.

Điểm mạnh so với check cũ: check cũ chặn theo **danh sách thứ ta nghĩ ra**; footprint
là thứ **host báo cáo sẽ ghi**. `transfer` lọt mọi check cấu trúc vẫn phải ghi balance
⇒ chết ở đây. Ca test then chốt đặt `ok: true` có chủ đích.

Thêm: simulate không đọc được `transactionData` → **chối**, không coi là footprint
rỗng. Credential **delegated** (`addressV2`, `addressWithDelegates` CAP-71) → mã lỗi
riêng `DELEGATED_CREDENTIALS_FORBIDDEN`. `contract_address` mọi entry khớp
`webAuthContractId` — đã có sẵn từ trước (`WRONG_CONTRACT`).

---

## 6 · §5 kịch bản #3 — một câu

**Veto CÓ phụ thuộc cứng vào backend**, vì bước nộp cần **ví phí ký envelope**
(`onchain-actions/service.ts:180-186`), trong khi `finalize_recovery` **không đòi auth
người dùng** nên kẻ tấn công nộp thẳng lên RPC công cộng và tự trả phí.

Hai lời gọi: `POST /api/recovery/veto` (dựng — FE tự làm được) và
`POST /api/recovery/submit` (ví phí ký + nộp — **FE không tự làm được**). Chi tiết,
điều kiện mainnet, phần FE cần gì: `VETO-DEPENDENCY.md`. **Chưa vá ở phiên này** —
nó là quyết định thiết kế + cần FE.

---

## 7 · §7 ghost connection — CHƯA ĐO ĐƯỢC

BE **không chạy trên VPS bằng PM2** ở môi trường này (deploy dùng Docker Compose,
`deploy/docker-compose.prod.yml`). Không có `pm2 restart vgd-be` để chạy, nên
**không có số connection trước/sau 3 lần restart**. Ghi **[chưa làm được]**, không
suy đoán.

Cái **đã** sửa (đọc cấu hình, không phải đo): ngân sách tắt máy đảo ngược
(10s < 13s < 15s), và connection Dragonfly thứ ba giờ được `quit()` lúc shutdown —
thiếu nó thì mỗi lần restart để lại một socket mồ côi.

---

## 8 · Còn nợ (KHÔNG tính là đóng)

- **Rate-limit XFF**: đã sửa code + Caddyfile nhưng **chưa có test hồi quy**, và
  **chưa kiểm qua nginx/Caddy thật**. Đây là lỗ 🔴 mà bằng chứng mới chỉ mức đọc
  cấu hình.
- **`statement_timeout` / pool cạn / secondaryStorage fail-fast**: chưa test "dừng
  Postgres → app suy giảm êm hay chết cứng". §7 đòi ca này, chưa làm.
- **Lọc-sau-LIMIT**: đã đưa vào SQL, **chưa có test** chứng minh `?status=` tìm được
  dòng ngoài 100 mới nhất.
- **CSRF (§6.2)**: middleware `csrf` của Hono **không bao giờ chạy với JSON**
  (`csrf/index.js:6,46` — chỉ khớp form/multipart/text-plain). Toàn bộ bề mặt ghi của
  API là JSON ⇒ tầng này gần như trang trí; phòng thủ thật là SameSite + CORS. nginx
  **không** xoá `Origin` nên tiền đề "proxy làm mất header" không đúng ở đây. **Chưa
  đổi gì** — cần quyết định (token-based hay chấp nhận bearer + SameSite).
- **Invites bypass `zv`**: `guardians/features/invites/handler.ts:16` import
  `zValidator as zv` thẳng, bỏ qua wrapper → 4 route trả **envelope lỗi khác** kèm
  nguyên cây ZodError. Chưa sửa.
- **N+1**: `heartbeat.repository.ts:36-94` (1+N SELECT, N transaction) và
  `jobs/recovery-watch.ts:52-72` (`.from(wallets)` **không LIMIT**, 2 RPC mỗi dòng).
  Chưa sửa.
- **Rò số dư qua `error.code`**: `INSUFFICIENT_BALANCE:{"balance":…}` nhét JSON vào
  field mà FE coi là enum. Chưa sửa.
- **API6 (§3.3)**: `POST /api/guardians/invites`, `/presence/ack`,
  `/inheritance/heartbeat`, `POST /api/intents` **không có rate limit**. `ack` INSERT
  một `presence_pings` mỗi guardian mỗi lần gọi — đường làm phình bảng. Chưa sửa.
- **SSE**: `GET /api/events` **không** phải code chết — auth-gated, kênh theo
  `user.id`, có pub/sub Dragonfly, được `closeRealtime()` lúc shutdown. **Giữ**, không
  xoá. (§8 đoán sai chỗ này.)

---

## 9 · Trạng thái `main`

**Chưa push.** Việc phải làm ở mục 10 của brief.

Một chuyện phải khai: trong phiên này **một tiến trình khác đang commit `fe/` liên
tục vào cùng repo**, trên chính branch `sec/be-audit-2026-07-25` tôi vừa tạo. Ba lần
commit đầu của tôi chết vì `cannot lock ref 'HEAD'` (HEAD nhảy giữa lúc ghi index).
Tôi **không** giành index chung nữa mà chuyển sang branch **BE-only**
`sec/be-audit-hardening`, dựng bằng index riêng (`GIT_INDEX_FILE`) + `update-ref`,
nhánh từ `d59dc54`. Kết quả sạch hơn: branch bảo mật không lẫn commit FE.

Branch này **không chứa** các commit FE của phiên kia. Ai merge phải biết điều đó.

---

## 10 · Ba dòng vẫn không tin, nếu là người mua bảo hiểm cho BE này

Cố ý **không lặp** ba dòng phiên trước (chúng nói về `DATABASE_URL` owner,
`jwt_version` chưa ai tiêu thụ, và footprint SEP-45 — cả ba đã đóng ở phiên này).

1. **Không có gì trong repo này từng chạy dưới tải, và không có ca nào kiểm hành vi
   khi hạ tầng chết.** Mọi kết luận về pool, shutdown, fail-fast ở mục 7 đều là **đọc
   cấu hình**, không phải đo. Tôi vừa sửa bốn thông số vận hành mà không quan sát
   được cái nào trong số đó dưới điều kiện thật — đúng loại thay đổi hay đẹp trên
   giấy và sai lúc 3 giờ sáng.
2. **Ví phí là điểm chết đơn của toàn bộ khả năng phòng thủ, và không ai canh nó.**
   Veto cần ví phí ký; ví phí cạn XLM có hậu quả **giống hệt** backend sập, nhưng nó
   xảy ra âm thầm và không có cảnh báo số dư nào. Kịch bản #3 không cần kẻ tấn công
   đánh sập backend — chỉ cần đợi ví phí hết tiền.
3. **`POST /api/guardians/invites/:token/accept` biến việc lộ một token thành việc
   mất một ghế guardian.** Bất kỳ tài khoản đăng nhập nào cầm token 64 ký tự đều
   thành người bảo hộ ví người khác: không bind email, chủ ví không xác nhận trước
   khi accept, không có yếu tố thứ hai. Token đó đi qua email — kênh mà mô hình đe
   doạ ở đây không hề coi là tin cậy được. Ghép với "2 guardian thông đồng" đã
   disclose từ đợt 1, đây là đường rẻ nhất để đạt ngưỡng.
