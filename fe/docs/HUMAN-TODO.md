# HUMAN-TODO — việc con người phải làm (agent không làm được)

> Cho tới khi các mục dưới xong, code vẫn AN TOÀN: build mặc định đã honest,
> pre-push chặn lỗi build, Cloudflare vẫn chạy Git-integration như cũ (chưa vỡ
> gì). Chỉ khi bạn tắt auto-build (mục 1) thì luồng deploy mới chuyển sang
> wrangler của `.github/workflows/deploy.yml`.

## 0. XÁC NHẬN CI ACTIONS XANH (làm trước tiên — workflow chạy lần đầu)

Máy dev không có `gh` CLI → agent không xem được kết quả run. Mở
`https://github.com/msci2026vn/mau-demo-fe-vite/actions` (và repo BE) → xem 2 run
mới nhất (`CI`, `Deploy`) XANH. Đã review tĩnh + mô phỏng local:
`bash -e` block "Prepare env" an toàn khi thiếu vars; asset gitleaks linux 8.30.1
tồn tại (HTTP 200); `bun install --frozen-lockfile` + `bun run validate` chạy được
KHÔNG cần `.env`. Rủi ro còn lại chỉ là tên Pages project — nếu khác `web`/`carbon`
thì set Variables `CF_PAGES_PROJECT_WEB` / `CF_PAGES_PROJECT_CARBON` (mục 2),
KHÔNG sửa code. Sau khi xanh → xoá branch `feat/core-hardening` +
`feat/email-otp-verification`.

**Chạy e2e local**: phải `cp apps/web/.env.example apps/web/.env` (và carbon)
trước, nếu không app throw lúc boot → mọi test báo "element not found" (BUG-007).

## 1. Cloudflare dashboard — tắt auto-build 2 Pages project (kích hoạt deploy cách B)

Với TỪNG project (web, carbon):
Workers & Pages → chọn project → **Settings → Builds & deployments** →
- **Tắt** "Automatic production branch deployments"
- Preview deployments → **None**

(Chỉ tắt trigger build — repo vẫn liên kết, wrangler direct-upload vẫn nhận.
Đã verify qua docs Cloudflare: Git-integrated project nhận `wrangler pages
deploy` bình thường, chỉ drag-and-drop bị cấm.)

## 2. Secrets + Variables cho GitHub Actions (deploy.yml)

Repo → Settings → Secrets and variables → Actions:

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Custom token: Account → **Cloudflare Pages: Edit** (token zone-scoped KHÔNG chạy) |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account ID (dashboard → Overview) |
| Variable | `CF_PAGES_PROJECT_WEB` / `CF_PAGES_PROJECT_CARBON` | tên 2 Pages project (mặc định `web` / `carbon`) |
| Variable | `VITE_API_URL` | URL BE production (bake vào bundle lúc CI build) |
| Secret | `SENTRY_AUTH_TOKEN` | Sentry org token (upload source map) |
| Variable | `SENTRY_ORG`, `SENTRY_PROJECT_WEB`, `SENTRY_PROJECT_CARBON` | slug Sentry |
| Secret | `VITE_SENTRY_DSN_WEB`, `VITE_SENTRY_DSN_CARBON` | DSN 2 project Sentry |

Chưa có secrets → deploy.yml vẫn XANH (build + audit chạy, deploy SKIP kèm notice).

## 3. Cài gitleaks binary (máy dev khác)

```bash
# Windows:  scoop install gitleaks   (hoặc winget install Gitleaks.Gitleaks)
# macOS:    brew install gitleaks
```
Máy dev hiện tại ĐÃ có (`C:\Users\huyng\bin\gitleaks.exe`).

## 4. Bật Renovate app trên repo GitHub

https://github.com/apps/renovate → Install → chọn repo. Bật Dependency graph +
Dependabot alerts để security-PR hoạt động.

## 5. Sau khi có DSN Sentry — verify chuỗi lỗi end-to-end

Deploy prod → ném 1 lỗi test → Sentry: event có stacktrace ĐÚNG DÒNG (source
map chạy), có user id, transaction có Web Vitals, lỗi liên quan API có trace
nối sang BE. (Phiên hardening chỉ verify được tới mức "SDK bắn envelope" vì
chưa có DSN thật — xem docs/HARDENING.md.)

## FamilyWallet (2026-07-20)

- [ ] **nginx CSP placeholder**: `apps/web/deploy/nginx.conf` dùng `connect-src 'self' __API_ORIGIN__`.
      Khi self-host phải thay `__API_ORIGIN__` bằng origin BE thật (= giá trị `VITE_API_URL` prod,
      vd `https://api.familywallet.app`) — bằng sed trong pipeline deploy hoặc sửa tay.
      Không thay = fetch + SSE bị CSP chặn. (Deploy Cloudflare Pages KHÔNG dùng file này.)
