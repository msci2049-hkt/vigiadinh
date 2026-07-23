# RUNBOOK — DEPLOY DOCKER LÊN VPS (project build từ template `mau-demo-be`)

> **Đối tượng đọc:** Claude / Claude Code trong một session MỚI, khi cần đưa 1 project (dựng từ template BE mẫu:
> Bun + Hono + Drizzle + Better Auth + Postgres 16 + Dragonfly + BullMQ + R2) lên một VPS Ubuntu, chạy bằng
> **Docker Compose**, cô lập tuyệt đối với project cũ trên cùng máy.
> **Đọc xong là biết:** có **14 PHASE**, trong đó **6 GATE bắt buộc** (fail = DỪNG, không đi tiếp), và **các
> thao tác CHỈ người làm được** (dashboard Cloudflare, firewall, secret) được đánh dấu 🖐️.
> **Nguồn gốc:** đúc kết từ 1 lần deploy thật đã trả giá bằng 6 giờ sự cố. Mỗi cảnh báo ⚠️ ở đây là 1 lần gãy thật.

---

## 0. TÓM TẮT — CLAUDE ĐỌC 60 GIÂY

**Mô hình:** GitHub → VPS clone về → VPS build & chạy Docker tại chỗ. Code KHÔNG đi qua máy local. Không sửa
một dòng code repo nào để deploy — mọi khác biệt môi trường nằm ở `.env.production` trên VPS.

**14 PHASE (thứ tự cứng, không đảo):**

| # | Phase | Loại | Gate? |
|---|---|---|---|
| 1 | SSH đúng máy + đúng user + check AVX2 | đọc | — |
| 2 | Scan VPS (project cũ, port, tài nguyên) | đọc | — |
| 3 | Cài Docker Compose v2 + buildx (additive) | thêm | — |
| 4 | Scan xung đột (port host, subnet) | đọc | **GATE 1** |
| 5 | Đưa code lên qua GitHub SSH deploy key | thêm | — |
| 6 | Tạo `.env.production` (openssl secret + placeholder) | thêm | — |
| 7 | **Preflight** (`env:check` + email + pool budget + no-dev-config) | đọc | **GATE 2** |
| 8 | Build + chạy Docker (project name riêng `-p`) | thay đổi | **GATE 3** |
| 9 | Test loopback (`/health`, `/ready`, PID count) | đọc | **GATE 4** |
| 10 | Reverse proxy (Caddy auto-TLS — ưu tiên) | thay đổi | — |
| 11 | DNS + TLS (Cloudflare grey → cert → cam Full Strict) | 🖐️ + đọc | **GATE 5** |
| 12 | Khóa origin (firewall chỉ IP Cloudflare) | 🖐️ | — |
| 13 | Nối FE (`app.<domain>` same-site + build lại) | 🖐️ | — |
| 14 | Smoke thật (SSE cross-process + burst) + dọn dẹp | đọc | **GATE 6** |

**3 NGUYÊN TẮC XƯƠNG SỐNG (chi phối mọi bước):**
1. **Scan trước, đổi sau.** Mọi bước đọc-trạng-thái làm trước; chỉ tác động khi đã hiểu.
2. **Chỉ thêm, không xóa.** Không bao giờ gỡ/xóa tài nguyên project cũ. Công cụ cài kiểu per-user plugin.
3. **Cô lập tuyệt đối.** Project name / network / volume / subnet / DB / port — tất cả riêng. Chỉ dùng chung reverse proxy ngoài cùng.

**FAIL-CLOSED cho Claude (đọc kỹ, áp mọi phase):**
- Gate fail → **DỪNG + báo người**, KHÔNG tự đi tiếp, KHÔNG "thử cách khác" mạo hiểm.
- Mơ hồ có thể phá dữ liệu / sai app → **DỪNG**, ghi rõ chỗ tắc.
- **KHÔNG** `git push -f`, **KHÔNG** `docker compose down -v`, **KHÔNG** `rm -rf`, **KHÔNG** `apt remove docker*`.
- Trước mọi lệnh GHI: xác nhận đang đúng VPS + đúng thư mục project + đúng user. Backup file trước khi sửa.
- Thao tác 🖐️ (dashboard/firewall/secret) → **hướng dẫn người làm tay**, agent KHÔNG tự làm (không có quyền / sai là tự khóa mình).

---

## PHASE 1 — SSH ĐÚNG MÁY + ĐÚNG USER + CHECK AVX2

⚠️ **Bẫy đã trả giá #1: gõ lệnh nhầm máy (local vs VPS) hoặc nhầm user (root vs user-app).**
Đầu dòng terminal là la bàn: `root@vps-host:~#` (kết thúc `#`) là VPS/root; `user@May-Local:~$` (kết thúc `$`)
là máy nhà. Container/process của VPS KHÔNG bao giờ hiện trong Docker Desktop của máy local — chúng là 2 thực thể
không nhìn thấy nhau.

⚠️ **Bẫy đã trả giá #2: app chạy bằng user thường (vd `appuser`), nhưng thao tác bằng `root`.**
`pm2`/`docker context` của `root` KHÁC của user-app → "không thấy process/container". Xác định app chạy bằng user
nào NGAY từ đầu và giữ đúng user đó xuyên suốt (dùng `su - <user> -c '...'` khi cần).

```bash
# 1. Xác nhận đúng máy + user
whoami                      # đúng user chưa (root để cài hệ thống; app chạy bằng user thường)
hostname                    # đúng VPS chưa
ip -4 addr | grep inet      # IP có khớp VPS đích không

# 2. CHECK AVX2 — SỐNG CÒN: Bun KHÔNG chạy nếu CPU thiếu AVX2 (crash ký tự lạ, khó đoán)
lscpu | grep -o avx2 && echo "AVX2 OK — Bun chạy được" || echo "❌ THIẾU AVX2 — DỪNG, VPS này không chạy Bun được"
```

**Kỳ vọng:** đúng máy/user, `AVX2 OK`. Thiếu AVX2 → **DỪNG**, đổi VPS. Đây là điều kiện cần tuyệt đối, không vá được.

---

## PHASE 2 — SCAN VPS (CHỈ ĐỌC, AN TOÀN TUYỆT ĐỐI)

Biết VPS đang chạy gì để không đụng, và còn thiếu công cụ nào.

```bash
docker ps                                    # project nào đang chạy, port nào đã bind — GHI LẠI để KHÔNG đụng
docker compose version                       # có Compose v2 chưa? (hay báo "unknown command")
git --version                                # git có sẵn?
which caddy; which nginx                      # đã có reverse proxy nào chưa
ss -tlnp | grep -E ':80|:443|:3000|:5432|:6379'   # port nào đã bận
free -h; nproc; df -h /                       # RAM / số core / dung lượng còn
```

**Kỳ vọng:** biết project cũ tên gì, DB/cache của nó có publish ra host không, port trống, số core (quyết định `WEB_INSTANCES`).
Ghi lại danh sách container + port đang chạy — đây là "vùng cấm", tuyệt đối không chạm.

---

## PHASE 3 — CÀI DOCKER COMPOSE V2 + BUILDX (ADDITIVE, KHÔNG GỠ GÌ)

Chỉ chạy nếu Phase 2 báo thiếu. Cài kiểu thêm-một-file (per-user plugin), chạy song song bản cũ.

⚠️ **TUYỆT ĐỐI KHÔNG** `apt remove docker docker.io docker-compose` — giết container project cũ đang chạy.

```bash
# Compose v2 (nếu "docker compose version" báo unknown)
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version          # phải ra v2.x

# buildx (chỉ khi Dockerfile dùng --mount=type=cache / BuildKit) — LẤY LINK QUA API, ĐỪNG ĐOÁN VERSION
BX_URL=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest \
  | grep "browser_download_url.*linux-amd64\"" | cut -d'"' -f4)
echo "Link: $BX_URL"            # phải là URL dài, không rỗng (đoán sai version → tải file lỗi vài byte)
curl -SL "$BX_URL" -o ~/.docker/cli-plugins/docker-buildx
chmod +x ~/.docker/cli-plugins/docker-buildx
docker buildx version           # phải ra github.com/docker/buildx v0.x
```

---

## PHASE 4 — SCAN XUNG ĐỘT TÀI NGUYÊN — **GATE 1**

Tìm port host trống + subnet compose có bị chiếm không.

```bash
ss -ltnp | grep -E ':8000|:3000' || echo "PORT TRONG"
# Kiểm subnet mà docker-compose.prod.yml định dùng (đọc file để biết dải, vd 172.30.0.0/16)
docker network inspect $(docker network ls -q) 2>/dev/null | grep -E '172\.30\.' || echo "SUBNET TRONG"
```

**GATE 1 — quyết định:**
- Port host bận (thường project cũ giữ `:3000`/`:8000`) → né bằng biến `APP_HOST_PORT=<port-trống>` trong `.env` (Phase 6). **KHÔNG sửa repo.**
- Subnet trống → deploy nguyên trạng.
- **Subnet BỊ CHIẾM** → đây là chỗ DUY NHẤT có thể buộc override repo. **DỪNG, hỏi người** (override subnet ngoài repo hay xin sửa compose). Không tự sửa.

---

## PHASE 5 — ĐƯA CODE LÊN QUA GITHUB SSH DEPLOY KEY

Code trên VPS là bản clone từ GitHub, KHÔNG từ local. Ưu tiên **SSH deploy key** (không hết hạn, không hiện secret) thay vì Personal Access Token (hay bị dán lộ).

```bash
# Trên VPS — tạo key
ssh-keygen -t ed25519 -C "vps-<proj>" -f ~/.ssh/id_<proj> -N ""
cat ~/.ssh/id_<proj>.pub    # dòng ssh-ed25519 ... là KHÓA CÔNG KHAI — dán lên GitHub vô hại
```

🖐️ **Người làm:** dán khóa công khai vào GitHub → repo → Settings → **Deploy keys** → Add (read-only là đủ).

```bash
# Test bắt tay ("does not provide shell access" KHÔNG phải lỗi)
ssh -i ~/.ssh/id_<proj> -o StrictHostKeyChecking=accept-new -T git@github.com

# Clone (chỉ repo BE — FE để Cloudflare Pages, không kéo về VPS)
mkdir -p ~/apps && cd ~/apps
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_<proj>" git clone git@github.com:<org>/<repo>.git <dir>
cd ~/apps/<dir>
git rev-parse HEAD          # GHI LẠI commit đang deploy (mốc rollback)
ls deploy/ src/ package.json   # xác nhận có deploy/, src/...
```

---

## PHASE 6 — TẠO `.env.production` (SECRET AN TOÀN + PLACEHOLDER)

⚠️ **QUY TẮC SECRET — KHÔNG NHÂN NHƯỢNG (đã trả giá: 1 API key thật bị dán vào chat 2 lần):**
- Secret KHÔNG bao giờ dán vào chat, KHÔNG in ra màn hình. Sinh thẳng vào file bằng `openssl`.
- **Lỡ dán/lộ secret ở đâu → REVOKE + tạo mới NGAY**, không "để thay sau". Từ giây lộ tới lúc thay, người khác đã dùng được.
- **KHÔNG ghi secret-đã-lộ vào hệ thống đang chạy** — đó là biến "lỡ lộ" thành "đã triển khai".
- Khi kiểm `.env`: luôn ẩn dòng secret bằng `grep -v -E 'PASSWORD|SECRET|KEY|TOKEN'`.
- `.env.production` chỉ nằm trên VPS, KHÔNG bao giờ lên GitHub (`.gitignore` chặn `.env*`, giữ lại `*.example`).

Đọc `deploy/.env.production.example` để biết ĐỦ biến bắt buộc. Sinh secret vào file, điền giá trị không-bí-mật, để placeholder cho dịch vụ chưa sẵn (app vẫn boot nếu biến đó không bắt-buộc-ở-prod):

```bash
cd ~/apps/<dir>
cat > deploy/.env.production << EOF
NODE_ENV=production
# --- DB (KHÔNG publish ra host — chỉ nội bộ container) ---
POSTGRES_USER=<proj>
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
POSTGRES_DB=<proj>
# pgvector nếu project dùng RAG (override image, không sửa compose):
POSTGRES_IMAGE=pgvector/pgvector:pg16
# --- App ---
APP_HOST_PORT=8000
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://api.<domain>
TRUSTED_ORIGINS=https://app.<domain>
COOKIE_DOMAIN=.<domain>
# --- Cluster / pool (theo bảng tier Phase 8) ---
WEB_INSTANCES=<số-core>
DB_POOL_MAX=<theo-bảng>
PG_MAX_CONNECTIONS=100
# --- Email (BẮT BUỘC THẬT ở prod — xem GATE 2) ---
RESEND_API_KEY=re_placeholder
EMAIL_FROM=noreply@<domain>
# --- R2 / Sentry / kênh (placeholder được nếu chưa dùng) ---
R2_ACCOUNT_ID=<id-công-khai>
R2_BUCKET=<bucket>
R2_ACCESS_KEY_ID=<DÁN_TAY_TRÊN_VPS>
R2_SECRET_ACCESS_KEY=<DÁN_TAY_TRÊN_VPS>
SENTRY_DSN=<optional>
TRUSTED_PROXY_ENABLED=true
TRUSTED_PROXY_CIDRS=<subnet-compose>
EOF

# Kiểm file, ẩn secret
grep -v -E 'PASSWORD|SECRET|KEY|TOKEN' deploy/.env.production
```

🖐️ **Người làm:** tự đắp các secret `<DÁN_TAY_TRÊN_VPS>` (R2 key...) bằng cách sửa file trên VPS (nano/vim), KHÔNG qua chat.

---

## PHASE 7 — PREFLIGHT — **GATE 2** (khâu chống crash-loop mù)

⚠️ **Đây là gate cứu mạng. Bỏ qua nó = flip prod xong crash-loop mà không biết vì sao — đã trả giá đúng chỗ này.**
Env của template validate bằng Zod lúc boot (`z.string().min(1)`), nên **thiếu 1 biến bắt buộc ở prod → app refuse-boot / crash-loop**. Phải kiểm TRƯỚC khi `up`.

```bash
cd ~/apps/<dir>

# 7.1 — env:check: chạy schema env.ts trên file .env.production, KHÔNG khởi động app, KHÔNG mở DB
bun install --frozen-lockfile
bun run env:check --env-file deploy/.env.production
#   → phải in "✅ env OK". Nếu ❌ → nó liệt kê TỪNG biến sai + lý do → sửa file → chạy lại. DỪNG cho tới khi ✅.
#   (Nếu template chưa có script env:check → thêm nó trước, đừng deploy mù.)

# 7.2 — EMAIL GATE: prod bật requireEmailVerification → RESEND phải THẬT + domain đã verify
grep -E '^RESEND_API_KEY=' deploy/.env.production | grep -qv placeholder \
  && echo "RESEND có vẻ thật" || { echo "❌ RESEND còn placeholder — user mới KHÔNG đăng ký được"; }
#   Kiểm key thật/đểu bằng cách gọi Resend (KHÔNG gửi mail cho ai):
curl -s -o /dev/null -w "Resend key HTTP: %{http_code}\n" https://api.resend.com/domains \
  -H "Authorization: Bearer $(grep ^RESEND_API_KEY= deploy/.env.production | cut -d= -f2)"
#   200 = key thật hợp lệ. 401 = key đểu/hết hạn → DỪNG, lấy key thật.
#   🖐️ Người làm: domain <domain> phải VERIFIED trên Resend (Domains = xanh) + DNS record DKIM/SPF đã thêm.
#   Domain chưa verify → mail không gửi được dù key đúng. Verify TRƯỚC (DNS cần propagate).

# 7.3 — POOL BUDGET: (WEB_INSTANCES+1) × DB_POOL_MAX ≤ 80% × PG_MAX_CONNECTIONS, nếu không app refuse-boot
#   Kiểm tay theo bảng Phase 8. Vượt → sửa WEB_INSTANCES/DB_POOL_MAX trước.

# 7.4 — KHÔNG còn config dev sót
grep -E '^(NODE_ENV|BETTER_AUTH_URL|TRUSTED_ORIGINS)=' deploy/.env.production
#   NODE_ENV=production, URL là https://...<domain>, KHÔNG còn "localhost"/"development" ở biến runtime.
```

**GATE 2:** cả 4 (env:check ✅ + Resend 200 + domain verified + pool budget đạt + no-localhost) phải qua. Bất kỳ cái fail → **DỪNG**, sửa, không `up`.

---

## PHASE 8 — BUILD + CHẠY DOCKER (PROJECT NAME RIÊNG) — **GATE 3**

Cờ `-p <proj>` → network/volume/container mang tiền tố riêng → tách hẳn project cũ.

**Bảng tier (đặt `WEB_INSTANCES` + `DB_POOL_MAX` theo số core):**

| Core | WEB_INSTANCES | DB_POOL_MAX | Σ conn (≤80) | Ghi chú |
|---|---|---|---|---|
| 4 | 4 | 12 | (4+1)×12=60 ✓ | Postgres chung box |
| 8 | 8 | 8 | (8+1)×8=72 ✓ | cân nhắc tách DB |
| 16 | 16 | 4 | (16+1)×4=68 ✓ | **PgBouncer bắt buộc** + `prepare:false`, tách DB box |
| 32 | 16–24 | qua PgBouncer | — | tách + read-replica |

Đồng thời `WEB_INSTANCES × HASH_MAX_CONCURRENT ≤ ~2×core` (nếu không, cảnh báo lúc boot).

```bash
cd ~/apps/<dir>
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose -p <proj> \
  --project-directory deploy \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.prod.yml \
  --profile prod \
  up -d --build
```

**GATE 3:** `docker compose -p <proj> ps` phải thấy `<proj>-postgres-1 healthy`, `<proj>-app-1 healthy`,
`<proj>-worker-1 running`. Build lần đầu vài phút — chữ chạy liên tục là bình thường.
- ⚠️ **Worker phải là 1 instance** (KHÔNG `--scale worker`) — nhân worker = cron double-fire.
- ⚠️ **Trong container KHÔNG dùng `node:cluster`** — chỉ reusePort (`src/cluster.ts` đã đúng, spawn theo `WEB_INSTANCES` tường minh, KHÔNG `nproc` vì trong container `nproc` báo core HOST).
- App refuse-boot với log "pool budget" → quay lại GATE 2 (Phase 7.3).
- ✅ **Lưu ý PATH:** deploy Docker KHÔNG dính bẫy PATH (container có bun trong image). Đây là 1 lợi thế lớn của Docker so với chạy PM2 native — nếu từng gặp `bun: command not found` khi reload PM2, Docker né được hẳn.

---

## PHASE 9 — TEST LOOPBACK — **GATE 4**

```bash
# /health = liveness (KHÔNG đụng DB) ; /ready = readiness (DB + Dragonfly đã nối)
curl -s http://127.0.0.1:8000/health   # {"ok":true,...}
curl -s http://127.0.0.1:8000/ready    # {"ok":true} — nếu 503 = DB/cache chưa nối, xem logs

# Đếm process thật trong container app (phải = WEB_INSTANCES)
docker exec <proj>-app-1 sh -c 'ps | grep -c "[b]un"'   # ≈ WEB_INSTANCES
```

**GATE 4:** `/health` và `/ready` đều `ok`, PID count khớp `WEB_INSTANCES`. Fail → `docker compose -p <proj> logs app --tail 50`, sửa, không đi tiếp.

---

## PHASE 10 — REVERSE PROXY (CADDY AUTO-TLS — ƯU TIÊN)

**Chọn Caddy, KHÔNG nginx+certbot.** Caddy tự xin + tự gia hạn TLS Let's Encrypt → ít thao tác tay, ít chỗ sai.
(Tài liệu deploy cũ dùng nginx+certbot là phương án thay thế — xem cuối file. Nếu VPS ĐÃ có nginx phục vụ app khác
thì dùng lại nginx, thêm server block mới, đừng cài Caddy chồng lên → tranh port 80/443.)

⚠️ Trước khi chạy Caddy phải xong: **firewall mở 80/443** + **DNS trỏ đúng IP + Cloudflare để GREY** (Phase 11 làm trước phần DNS grey, rồi mới Caddy). Thứ tự đúng: mở firewall → DNS grey → `dig` xác nhận → Caddy.

```bash
# Mở firewall 80/443 (nếu đang chặn)
ufw allow 80/tcp && ufw allow 443/tcp && ufw reload && ufw status | grep -E '80|443'

# Cài Caddy (nếu chưa có)
which caddy || (apt update && apt install -y debian-keyring debian-archive-keyring apt-transport-https curl && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \
apt update && apt install -y caddy)

# Vhost — 2 header quan trọng cho template:
cat > /etc/caddy/Caddyfile << 'EOF'
api.<domain> {
    reverse_proxy 127.0.0.1:8000 {
        header_up X-Real-IP {remote_host}
        flush_interval -1
    }
}
EOF
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile && systemctl restart caddy
```

⚠️ **2 header BẮT BUỘC** (khớp template):
- `header_up X-Real-IP {remote_host}` — app chống spoof rate-limit theo IP. **KHÔNG** để proxy append
  `X-Forwarded-For` kiểu `$proxy_add_x_forwarded_for` (nginx) — client tự bơm header giả sẽ bypass rate-limit.
- `flush_interval -1` — tắt buffer cho **SSE/chat stream** (`GET /api/events`) không bị đứng. Tương đương
  `proxy_buffering off` của nginx. Thiếu cái này = chat "đơ" mà không rõ vì sao.

---

## PHASE 11 — DNS + TLS (CLOUDFLARE) — **GATE 5**

🖐️ **Thứ tự SỐNG CÒN (sai là cert fail — đã trả giá):**

**Bước A — DNS grey (để Caddy lấy cert):**
- Cloudflare → `<domain>` → DNS → Records → thêm/sửa: `api` A → `<IP-VPS>`, Proxy status = **DNS only (mây XÁM)**.
- ⚠️ **Phải XÁM** khi xin cert. Mây cam (proxied) chặn Let's Encrypt xác thực → Caddy fail.

**Bước B — xác nhận DNS đã lan (trên VPS), rồi mới chạy Caddy (Phase 10):**
```bash
dig +short api.<domain> A   # phải ra đúng IP VPS. Rỗng/sai → đợi 2–3 phút, dig lại. Đừng chạy Caddy khi chưa đúng.
```

**Bước C — sau khi Caddy restart, verify cert thật:**
```bash
curl -s -o /dev/null -w "api.<domain>/health: %{http_code}\n" https://api.<domain>/health   # phải 200
echo | openssl s_client -connect api.<domain>:443 -servername api.<domain> 2>/dev/null \
  | openssl x509 -noout -issuer -dates   # issuer=Let's Encrypt + notAfter ~3 tháng = cert sống
```

**Bước D — bật cam SAU khi có cert:**
- Cloudflare → `api` → đổi về **Proxied (mây CAM)**.
- SSL/TLS → mode = **Full (Strict)**.
- (Caddy đã có cert nên bật cam giờ an toàn — được WAF + giấu origin.)

**GATE 5:** `curl https://api.<domain>/health` = 200 + issuer Let's Encrypt. Fail → `journalctl -u caddy --no-pager -n 30`,
nguyên nhân thường: firewall chưa mở / Cloudflare còn cam khi xin cert / DNS chưa propagate. Sửa, không đi tiếp.

---

## PHASE 12 — KHÓA ORIGIN (FIREWALL CHỈ IP CLOUDFLARE)

🖐️ **Chỉ làm SAU khi Phase 11 bật cam.** Giờ `:80/:443` mở cho cả internet → attacker đấm thẳng VPS, vòng qua WAF.
Khóa lại chỉ nhận từ dải IP Cloudflare. (Đây là mảnh vá đúng lỗ webhook forgery.)

⚠️ **Nguy hiểm: sai rule = tự khóa mình khỏi VPS.** Giữ SSH (22) mở. Nên đặt lệnh rollback hẹn giờ trước khi áp:
```bash
# An toàn: hẹn giờ mở lại nếu 5 phút không hủy (phòng tự khóa)
echo 'ufw --force reset && ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable' | at now + 5 minutes

# Lấy dải IP Cloudflare chính thức + build rule (giữ 22, chỉ CF cho 80/443)
# (Xác minh danh sách tại cloudflare.com/ips — v4 + v6)
ufw allow 22/tcp
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from $ip to any port 80,443 proto tcp; done
# ... (v6 tương tự từ ips-v6)
ufw --force enable && ufw status
# Test còn vào được api qua Cloudflare → nếu OK, HỦY lệnh hẹn giờ: atrm <job-id>
```

---

## PHASE 13 — NỐI FE (`app.<domain>` SAME-SITE + BUILD LẠI)

⚠️ **Bẫy cookie đã trả giá:** FE ở `*.pages.dev` + API ở `api.<domain>` = **khác site** → cookie session Better Auth
(không JWT) vỡ hoặc phải `SameSite=None` mong manh. Fix đúng: FE về `app.<domain>` → **same-site** với API →
cookie `.<domain>` chạy sạch với `SameSite=Lax`.

🖐️ **Người làm — Cloudflare Pages (KHÔNG phải trang DNS):**
1. Workers & Pages → project FE → **Custom domains** → Set up → `app.<domain>` (tự thêm CNAME + tự cấp SSL).
2. Settings → Environment variables → **Production**: `VITE_API_URL = https://api.<domain>`.
   ⚠️ Vite nướng env **lúc build** → Save xong phải **Deployments → Retry/Redeploy** (build lại). Không build lại = env cũ, FE trắng.

**Verify (mở `https://app.<domain>`, F12 → Network, thử login):**
- Request đi tới `api.<domain>` ✓
- Response `Set-Cookie` có `Domain=.<domain>` ✓
- Không lỗi CORS ✓

---

## PHASE 14 — SMOKE THẬT — **GATE 6** + DỌN DẸP

Template có phần "chưa production-proven" (SSE cross-process + cluster) — phải chạy smoke thật trên stack đầy đủ.

```bash
# 1. SSE fan-out cross-process (cần Dragonfly chạy)
docker compose -p <proj> exec app sh -c 'RUN_REALTIME_IT=1 bun test src/lib/realtime.integration.test.ts'

# 2. Đa-process: PID count đã check ở GATE 4. Kiểm lại /health qua domain public.
curl -s https://api.<domain>/health

# 3. Burst login (đo p95 + connection budget)
#   ~200 req POST /api/auth/sign-in/email → p95 /health dưới ngưỡng,
#   SELECT count(*) FROM pg_stat_activity ≤ budget, kiểm 503 HASH_CAPACITY + Retry-After khi quá tải.
```

**GATE 6:** smoke SSE cross-process pass + burst không vỡ budget. Fail → không coi là "đã production-proven", báo người.

**Dọn dẹp sau go-live (không gấp nhưng phải làm):**
- 🖐️ **Revoke MỌI secret đã lộ** trong lúc làm (GitHub token, R2 key, và đặc biệt bất kỳ key nào lỡ dán vào chat/log). Đổi mật khẩu VPS (`passwd`).
- Điền secret thật còn placeholder → `docker compose -p <proj> ... up -d` (không cần `--build` nếu chỉ đổi env).
- Tạo admin thật, xóa tài khoản demo trên prod. Đổi `package.json` name khỏi `mau-demo` nếu còn.
- `pg_dump` backup đẩy **off-VPS** (mất VPS là mất luôn backup nếu để cùng chỗ).

---

## VÒNG LẶP RA BẢN MỚI (sau lần deploy đầu)

Sửa code LUÔN ở local, không bao giờ trên VPS. VPS chỉ kéo về + dựng lại.

```bash
# 1) Local: sửa → push (KHÔNG git add . ; stage đúng file ; KHÔNG --no-verify)
git add -A && git commit -m "feat: ..." && git push origin main

# 2) VPS: kéo bản mới (data DB không mất; .env không bị git pull đụng vì .gitignore chặn)
cd ~/apps/<dir> && GIT_SSH_COMMAND="ssh -i ~/.ssh/id_<proj>" git pull --ff-only origin main

# 3) VPS: preflight lại RỒI dựng lại (env có thể đã thêm biến mới)
bun run env:check --env-file deploy/.env.production   # GATE — fail là DỪNG, không up
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose -p <proj> --project-directory deploy --env-file deploy/.env.production \
  -f deploy/docker-compose.prod.yml --profile prod up -d --build

# 4) Verify: curl /health + /ready. Rollback nếu hỏng: git reset --hard <commit-cũ> && up -d --build
```

---

## CATALOG LỖI (TRIỆU CHỨNG → NGUYÊN NHÂN → SỬA) — đúc kết từ sự cố thật

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Lệnh "trên VPS" ra kết quả lạ / không thấy container | Đang gõ ở local, hoặc nhầm user (root vs app) | Liếc hostname + `whoami`. `su - <user>` đúng user |
| `bun: command not found` khi reload (chạy PM2 native) | PATH thiếu `.bun/bin` (vd `--update-env` nạp PATH shell) | Docker né hẳn. Nếu PM2: nhét PATH vào ecosystem env; đừng `--update-env` mù |
| App crash-loop ngay sau flip prod, health 000 | Biến prod bắt buộc thiếu/placeholder → Zod refuse-boot (RESEND rỗng…) | GATE 2: `env:check --env-file` TRƯỚC khi up. Cắm secret thật |
| App refuse-boot, log "pool budget" | (WEB_INSTANCES+1)×DB_POOL_MAX > 80%×max_conn | Giảm WEB_INSTANCES/DB_POOL_MAX theo bảng tier |
| Prod chạy nhưng như dev (auth/cookie vỡ) | `.env` còn NODE_ENV=development / URL localhost | GATE 2 Phase 7.4: đảm bảo prod + URL domain |
| Auth vỡ / cookie không set khi lên domain | FE khác-site với API (pages.dev vs api.<domain>) | FE về `app.<domain>` same-site + COOKIE_DOMAIN=.<domain> |
| FE trắng màn sau deploy | `VITE_*` thiếu lúc build (env build-time) | Set `VITE_API_URL` ở Pages → **build lại** |
| certbot/Caddy Timeout / unauthorized khi xin cert | Cloudflare đang cam, hoặc DNS chưa lan, hoặc port 80 chặn | DNS grey (xám) + `dig` xác nhận + mở 80/443, rồi mới xin cert |
| `address already in use` | Port host trùng project cũ | Đổi `APP_HOST_PORT` trong .env (không sửa repo) |
| `up` đòi network nhưng đụng subnet | Subnet compose bị chiếm | GATE 1: override subnet ngoài repo / xin sửa compose |
| SSE/chat đứng, không stream | Proxy buffering bật | Caddy `flush_interval -1` (nginx: `proxy_buffering off` + `Connection ''`) |
| Rate-limit bị bypass, ai cũng qua | Proxy append X-Forwarded-For → client spoof IP | Ghi đè `X-Real-IP {remote_host}`, không append |
| `the --mount option requires BuildKit` | BuildKit/buildx chưa bật | `export DOCKER_BUILDKIT=1` + cài buildx (Phase 3) |
| buildx tải về ~9 byte, vẫn "unknown command" | Đoán sai version → URL 404 trả trang lỗi | Lấy link `releases/latest` qua GitHub API |
| MCP/tool thao tác nhầm sang app khác trên cùng VPS | Tool bind sai base path (vd MCP clone giữ path app cũ) | Verify path/app trước mọi lệnh ghi; MCP riêng cho mỗi app |
| Bun crash ký tự lạ ngay khi start | CPU thiếu AVX2 | Phase 1: `lscpu | grep avx2`; thiếu → đổi VPS |
| Mail gửi 401 dù đã cắm key | Key đểu/hết hạn, hoặc domain chưa verify ở Resend | Phase 7.2: Resend trả 200 + domain verified TRƯỚC khi launch |

---

## CHECKLIST CÔ LẬP KHỎI PROJECT CŨ (rà trước khi `up`)

- ☐ `-p <proj>` đặt project name riêng (network/volume/container có tiền tố riêng).
- ☐ Postgres/Dragonfly trong compose **KHÔNG publish ra host** (chỉ nội bộ container).
- ☐ App bind `127.0.0.1:<port-trống>`, không `0.0.0.0`.
- ☐ Subnet compose còn trống trên VPS (GATE 1).
- ☐ Reverse proxy: THÊM vhost mới, không sửa vhost cũ; `reload` không `restart` (nếu dùng nginx chung).
- ☐ KHÔNG `apt remove` / `docker rm` / `compose down -v` lên tài nguyên project cũ.
- ☐ `.env.production` chỉ ở VPS; `.gitignore` chặn `.env*`, giữ `*.example`.
- ☐ Worker `instances=1`; không `--scale worker`.

---

## PHỤ LỤC A — PHƯƠNG ÁN NGINX + CERTBOT (thay cho Caddy)

Dùng khi VPS đã có nginx phục vụ app khác (dùng lại, thêm server block). Xem site cũ làm mẫu, tạo file MỚI:

```bash
cat > /etc/nginx/sites-available/api.<domain> << 'EOF'
server {
    listen 80;
    server_name api.<domain>;
    client_max_body_size 10M;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;   # GHI ĐÈ, không $proxy_add_x_forwarded_for
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                              # SSE
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
ln -s /etc/nginx/sites-available/api.<domain> /etc/nginx/sites-enabled/
nginx -t                  # PHẢI "syntax is ok" + "test is successful" — sai thì DỪNG, đừng reload
systemctl reload nginx    # reload (KHÔNG restart) → project cũ không gián đoạn
# DNS grey → certbot (Cloudflare phải XÁM khi xin cert)
certbot --nginx -d api.<domain>
```

## PHỤ LỤC B — PHƯƠNG ÁN GHCR (build ở CI, VPS chỉ pull image)

Khi được phép sửa compose: `app`/`worker` từ `build:` → `image: ghcr.io/<org>/<repo>:${TAG:-latest}`.
Build+push ở local/CI, VPS `docker login ghcr.io` (PAT scope `read:packages`) → `pull && up -d`.
Lợi: không ngốn CPU build trên prod (an toàn cho project cũ) + rollback = kéo lại tag cũ.

---

*Runbook này là nguồn authoritative cho việc deploy Docker. Chi tiết thực thi từng tính năng nằm ở
`.claude/skills/deploy-vps/` + `.claude/rules/*` của template. Cập nhật file này mỗi khi gặp footgun mới —
mỗi dòng ⚠️ ở đây là một lần đã trả giá bằng thời gian thật.*
