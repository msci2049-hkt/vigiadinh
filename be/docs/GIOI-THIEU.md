# Giới thiệu BE mẫu — dùng gì, làm được gì, phải cẩn thận chỗ nào

> Tài liệu cho **người đọc**. Bản dành cho Claude Code là [`CLAUDE.md`](../CLAUDE.md) ở root.
> Mọi thông tin dưới đây lấy từ code thật trên branch `main`.

Đây là **backend mẫu** để degit sang dự án mới. Cài xong là đã có sẵn đăng ký / đăng nhập /
xác minh email / quên mật khẩu / API quản trị / phân quyền / realtime / hàng đợi job, cộng với
lớp bảo mật và quy trình deploy đã chạy thật.

> Đọc **mục 2.4** trước khi hứa với ai: webhook và cron **có sẵn code nhưng chưa nối dây**.

---

## 1. Dùng ngôn ngữ gì

**Toàn bộ code là TypeScript.** Không có JavaScript viết tay, không có `any`, không `@ts-ignore`.

Điểm khác biệt lớn nhất so với backend Node thông thường: **runtime là Bun, không phải Node.js.**
Mọi lệnh đều là `bun ...` / `bunx ...`. Bun đóng luôn vai trò trình chạy TypeScript (không cần
`ts-node`/`tsx`), trình chạy test (`bun test`), và trình quản lý package (`bun.lock`).

Các ngôn ngữ phụ xuất hiện trong repo:

| Ngôn ngữ | Dùng ở đâu | Vì sao |
|---|---|---|
| TypeScript | toàn bộ `src/`, `scripts/` | ngôn ngữ chính |
| SQL | `drizzle/0000_*.sql` … `0006_*.sql` | migration do `drizzle-kit` **sinh ra** — không sửa tay |
| SQL (viết tay) | `drizzle/auth-indexes.sql`, `drizzle/postgis.sql` | 2 script chạy-một-lần mà drizzle-kit không sinh được (index tối ưu auth; extension + cột geometry + trigger PostGIS) |
| Bash | `entrypoint.sh`, `deploy/*.sh`, `.claude/hooks/*.sh` | script vận hành, git hook |
| Dockerfile / YAML | `Dockerfile`, `docker-compose*.yml`, `.github/workflows/` | đóng gói + CI |

**Tiếng Việt hay tiếng Anh?** Comment trong code, tài liệu và rule viết **tiếng Việt**; còn tên
biến, tên hàm, và **mã lỗi nghiệp vụ** (`PAYMENT_NOT_FOUND`, `INSUFFICIENT_BALANCE`) viết **tiếng Anh**.

### Thư viện chính (version chính xác trong `package.json`)

| Vai trò | Thư viện | Version |
|---|---|---|
| Web framework | `hono` | `^4.12.28` |
| Xác thực | `better-auth` | `^1.6.23` |
| ORM / DB | `drizzle-orm` + `postgres` (postgres-js) | `^0.45.2` + `^3.4.9` |
| Hàng đợi | `bullmq` + `ioredis` | `^5.76.7` + `^5.10.1` |
| Validate | `zod` | `^4` |
| Log | `pino` | `^10.3.1` |
| Theo dõi lỗi | `@sentry/bun` | `^10.52.0` |
| Gửi email | `resend` (prod) / `nodemailer` (dev) | `^6.12.3` / `^9.0.3` |
| Gọi API ngoài | `ofetch` + `cockatiel` (retry + circuit breaker) | `^1.5.1` + `^3.2.1` |
| Lint + format | `@biomejs/biome` (**không** ESLint/Prettier) | `^2.4.15` |

Database là **PostgreSQL 16**. Cache / hàng đợi / pub-sub dùng **Dragonfly** (tương thích Redis,
nhanh hơn, chạy đa luồng).

> ⚠️ TypeScript ở BE khai là `peerDependency ^5.9.3`. Bên FE mẫu lại dùng `^6.0.3`. Hai repo
> **lệch major TypeScript** — bình thường vì không chia sẻ code, nhưng đừng bê `tsconfig` qua lại.

---

## 2. Có tính năng gì

### 2.1. Xác thực & tài khoản

- **Đăng ký / đăng nhập bằng email + mật khẩu.** Mật khẩu tối thiểu **12 ký tự**, băm bằng
  `scrypt` (ghim tham số thủ công để nâng cấp thư viện không làm hỏng mật khẩu cũ).
- **Xác minh email bằng OTP 6 số** — không phải link. Mã sống **5 phút**. Được nhập sai tối đa **5 lần**;
  đến **lần thứ 6** thì server trả `TOO_MANY_ATTEMPTS`, **xoá luôn mã**, phải xin mã mới
  (`allowedAttempts: 5` — Better Auth chặn khi `attempts >= 5`, và chỉ tăng bộ đếm *sau* khi kiểm).
- **Quên mật khẩu cũng bằng OTP 6 số.** Hàm gửi link đặt-lại-mật-khẩu (`sendResetPassword`) đã bị gỡ, nên
  endpoint `/reset-password` theo token tuy **vẫn còn đăng ký** nhưng không ai phát token cho nó nữa (nằm im).
- **Session là cookie**, không phải JWT — không lưu token, không silent-refresh.
- Nhập email không tồn tại ở màn quên-mật-khẩu vẫn trả về "thành công" — **cố ý**, để kẻ tấn công
  không dò được email nào có trong hệ thống. Đừng "sửa" thành báo lỗi.

### 2.2. Quản trị & phân quyền

- Có sẵn **API quản trị**: liệt kê user, tạo user, đổi role, khoá/mở khoá (ban), **đóng giả user**
  (impersonate), thu hồi phiên đăng nhập.
- Phân quyền Better Auth có **đúng 2 role**: `admin` và `user`. Muốn thêm role thì phải khai **cả ở BE
  lẫn FE** (xem mục 4).
- **Chống tự phong quyền khi đăng ký** — bảo vệ 3 lớp. Đây là lỗ hổng kinh điển: client gửi
  `{"role":"admin"}` vào API đăng ký. Template chặn ở cả tầng schema, tầng database hook, và tầng luật.

### 2.3. Realtime và job nền

- **SSE** (server đẩy sự kiện xuống browser) tại `GET /api/events`. Mỗi user nghe kênh riêng
  `sse:user:{id}`, xác thực bằng cookie. Chạy được **nhiều tiến trình** vì fan-out qua pub/sub của Dragonfly.
- **Hàng đợi job** bằng BullMQ, worker chạy **tiến trình riêng** (`bun run worker`), có retry (5 lần),
  backoff luỹ thừa, và chống trùng bằng `jobId`.

### 2.4. Có sẵn CODE nhưng CHƯA nối dây (đừng tưởng là chạy được)

Hai thứ hay bị hiểu nhầm là "template đã làm sẵn cho rồi":

- **Webhook.** File `src/services/webhooks/verify.ts` có hàm xác thực chữ ký HMAC (Stripe, GitHub, SePay)
  và `src/middlewares/raw-body.ts` có `captureRawBody`. Nhưng **không route nào gọi chúng**, **không có bảng
  `webhook_events`**, và `captureRawBody` **không được mount ở đâu cả**. Đây là **thư viện + bản mẫu**, không
  phải endpoint đang chạy. Muốn nhận webhook thật → dùng skill `webhook-receiver`, nó dựng đủ 3 lớp bảo vệ
  (HMAC chống timing-attack, timestamp chống replay, unique index chống xử lý trùng).
- **Cron.** `src/lib/redlock.ts` có khai `redlock` nhưng **không file nào import**. **Không có repeatable job
  nào** — cả 2 job hiện có đều được đẩy vào hàng đợi theo sự kiện, không theo lịch. Muốn cron → skill `new-cron`.

### 2.5. Vận hành & bảo mật (đã bật sẵn)

- `GET /health` (còn sống không) và `GET /ready` (Postgres + Dragonfly có sẵn sàng không).
- **Tắt máy êm** (graceful shutdown): rút cạn request đang chạy, tối đa 10 giây, rồi mới đóng.
- **Security headers** + **CSRF** trên mọi `/api/*`; CSP khoá chặt `default-src 'none'` (API chỉ trả JSON).
- **Giới hạn tần suất** cho các route nhạy: đăng nhập 5 lần/phút, đăng ký 3 lần/phút, gửi OTP 2 lần/phút…
- **Chặn tự-DoS khi băm mật khẩu**: chỉ cho 2 request băm chạy song song, quá tải trả `503`.
- **Sentry** (lỗi + trace), **pino** (log có che thông tin nhạy cảm: password, token, cookie).
- **CI chặn thật**: lỗi typecheck/lint/kiến trúc → đỏ; có CVE mức high/critical → đỏ; lộ secret trong
  toàn bộ lịch sử git → đỏ.
- **Deploy Docker lên VPS** có cổng kiểm tra theo thứ tự: kiểm tra env → build → chạy migration →
  mới bật container mới. Hỏng ở bước nào thì dừng ở đó, **bản cũ vẫn đang chạy**.

### 2.6. Trạng thái sau bootstrap FamilyWallet (2026-07-20)

Repo này đã chạy `node scripts/init-project.mjs familywallet-api` — **lớp demo nghiệp vụ "carbon"
của template (9 module + 2 job + lib liên quan) đã xoá sạch**. `src/modules/` hiện còn 2 module lõi
template: `product` (module mẫu, kiểu Vertical Slice — dùng làm khuôn) và `realtime` (SSE),
cộng các module FamilyWallet đang dựng (xem `CLAUDE.md`).

---

## 3. Các điểm lưu ý

### 3.1. Cái sẽ cắn bạn ngay ngày đầu

**`TRUSTED_ORIGINS` phải chứa origin của FE.** Biến này nuôi **cả ba** thứ cùng lúc: CORS, CSRF,
và `trustedOrigins` của Better Auth. Mặc định trong `.env.example` đã đúng cho dev
(`http://localhost:5173,http://localhost:5174`) — nhưng nếu FE của bạn chạy ở origin khác mà quên
sửa theo thì FE **không đăng nhập được**, cookie không bao giờ được lưu, SSE không chạy — mà
không có thông báo lỗi nào rõ ràng.

**Đọc email dev ở đâu?** Mailhog: <http://localhost:8025>. Chạy `docker compose up -d`
(không kèm tên service) để có đủ postgres + dragonfly + mailhog.

### 3.2. Tài liệu cũ nói sai, tin code

Có hai chỗ trong `.claude/rules/` mô tả **sai so với code**, mà rule thì tự động nạp vào context:

1. `rules/auth.md` vẽ thứ tự middleware là `CORS → auth.handler → session`. **Sai.** Code thật chèn
   `secureHeaders → csrf → requestId → logger → hashGuard` vào giữa. Làm theo rule là **gỡ mất lớp
   bảo mật** khỏi `/api/auth/*`.
2. `rules/db-schema.md` ví dụ khoá ngoại `.references(() => users.id)`. **Không có bảng `users`** nào
   như vậy. Xem mục dưới.

### 3.3. Bảng nghiệp vụ tham chiếu tới user thế nào

Bảng `user` do Better Auth CLI sinh ra, khoá chính kiểu `text`. Còn quy ước của template là khoá
chính **ULID `varchar(26)`**. Hai kiểu này **không ghép khoá ngoại được**.

Nên: bảng nghiệp vụ dùng **tham chiếu mềm** — cột `varchar("user_id", { length: 64 })` + index,
**không** `.references()`. Khoá ngoại cứng chỉ dùng giữa các bảng do mình tự viết với nhau.
(Mẫu cũ `src/db/schema/plots.ts` đã xoá cùng lớp demo — xem ví dụ trong `.claude/rules/db-schema.md`.)

### 3.4. Luật không được phá (phá là CI đỏ hoặc mất dữ liệu)

- **Migration chỉ được thêm, không được xoá cột.** Muốn xoá phải đi quy trình 3 lần release.
  Xoá thẳng = mất dữ liệu không rollback được.
- **Tiền lưu kiểu số nguyên**, tuyệt đối không `float` (sai số float → lệch sổ). Rule viết `integer`
  (cents); miền giá trị lớn (stroop của Stellar) thì `bigint`. Luôn là **số nguyên**.
- **Không dùng Redlock cho thanh toán.** Redlock chỉ để tối ưu, không đảm bảo đúng đắn — dùng cho
  charge/refund có thể **trừ tiền 2 lần**. Phải dùng transaction + idempotency key trong Postgres.
- **Tên queue BullMQ bắt buộc có `{ngoặc nhọn}`**, nếu không Dragonfly dồn hết về 1 luồng.
- **Handler của `eventBus` phải đồng bộ, không I/O.** Việc cần chắc chắn chạy (gửi mail, gọi API)
  thì đẩy vào BullMQ — `eventBus` không có retry, process chết là mất việc.
- **Mọi input HTTP phải qua `zv()`**, không dùng `zValidator` trực tiếp.
- **File không quá 300 dòng.**

### 3.5. Bẫy đã trả giá thật

- **`bun run validate` KHÔNG chạy test.** Nó chỉ chạy typecheck + lint + kiểm tra kiến trúc + kiểm
  tra env. Sửa `hash-guard.ts` thì phải tự chạy `bun test` — không có gì nhắc bạn.
- **Cookie-cache trễ 5 phút.** Đăng xuất / khoá user / hạ quyền có thể mất tới 5 phút mới thực sự
  có hiệu lực (vì session được ký vào cookie để đỡ query DB). Route thật sự nhạy cảm thì phải tự
  kiểm tra denylist.
- **Từ Better Auth 1.6.21**, rate limit chạy **trước** handler của plugin. Nên ở endpoint có giới hạn ngặt
  hơn số lần thử (ví dụ `reset-password`: 5 lần/5 phút), người dò OTP sẽ ăn **`429`** trước khi kịp thấy
  `403 TOO_MANY_ATTEMPTS`. Ở endpoint nới hơn (`verify-email`: 10 lần/phút) thì vẫn trả `403`.
  **FE phải xử lý cả hai mã.**
- **Test đỏ giả**: nếu cổng `5432` trên máy đang là Postgres của **dự án khác**, test tích hợp sẽ đỏ
  với lỗi kiểu "thiếu cột `org_id`". Đó là lỗi môi trường, không phải lỗi code. **Đừng nới test.**
- **Nhật ký bug nằm ở 2 file khác nhau**: `.claude/ERRORS.md` (BUG-001…013 + bảng pattern hay gây bug)
  và `ERRORS.md` ở root (BUG-014). Hai file **không trùng nhau**, đọc cả hai.

---

## 4. BE ghép với FE thế nào

FE mẫu là repo `mau-demo-fe-vite`. Bốn thứ **bắt buộc khớp**:

| # | Ràng buộc |
|---|---|
| 1 | BE `TRUSTED_ORIGINS` **phải chứa** origin của FE (dev: `http://localhost:5173`) |
| 2 | BE `BETTER_AUTH_URL` **phải bằng** FE `VITE_API_URL` (cùng là gốc của BE) |
| 3 | **Phần khai báo** (`statement`, `ac`, `roles`, `AppRole`) trong `src/lib/access-control.ts` (BE) và `packages/auth/src/access-control.ts` (FE) phải **giống hệt nhau** — chép tay, không phải package chung. Hiện đang khớp (chỉ khác phần comment). Lệch nhau là FE cho bấm nút mà server từ chối |
| 4 | Thêm role mới = sửa **cả hai repo** |

Cách giao tiếp: FE gọi bằng `fetch` thường (không phải Hono RPC — file `rpc.ts` bên FE mới chỉ là
khung rỗng), luôn kèm `credentials: 'include'` để gửi cookie. Chưa đăng nhập thì BE trả `401` và FE
tự đá về `/login`. Quá tải thì BE trả `503 + Retry-After` và FE tự chờ rồi thử lại.

Giới thiệu phía FE: [`mau-demo-fe-vite/docs/GIOI-THIEU.md`](https://github.com/msci2026vn/mau-demo-fe-vite/blob/main/docs/GIOI-THIEU.md).

---

## 5. Bắt đầu

```bash
bun install
cp .env.example .env          # default dev chạy được; đổi origin FE thì sửa TRUSTED_ORIGINS (mục 3.1)
bun run env:check             # báo ngay biến nào thiếu/sai
docker compose up -d          # postgres + dragonfly + mailhog
bun run auth:generate
bun run db:migrate
bun run seed:admin            # dev: admin@example.com / admin123456789
bun run dev                   # http://localhost:3000
bun run worker                # cửa sổ thứ hai — chạy job nền
```

Đi sâu hơn: [`CLAUDE.md`](../CLAUDE.md) (bản đồ + luật) · `.claude/skills/` (quy trình theo từng
loại task) · [`docs/HUONG-DAN-DEPLOY-DOCKER-VPS.md`](HUONG-DAN-DEPLOY-DOCKER-VPS.md) (deploy) ·
[`docs/HUMAN-TODO.md`](HUMAN-TODO.md) (việc con người phải tự làm).
