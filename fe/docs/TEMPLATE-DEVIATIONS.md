# TEMPLATE-DEVIATIONS — chỗ tài liệu/rule nói SAI so với code (FE)

> Nguyên tắc: tài liệu mâu thuẫn code → TIN CODE, ghi vào đây. Cập nhật 2026-07-20 (bootstrap FamilyWallet).

## 1. Rule/doc lạc hậu đã SỬA trong repo này

| Chỗ sai | Thực tế code | Đã xử lý |
|---|---|---|
| `.claude/rules/module-boundary.md` nói enforcer là `scripts/check-boundaries.ts` | File đó KHÔNG tồn tại. Enforcer thật: `packages/config/scripts/check-boundaries.mjs`, gọi qua script `boundaries` của từng app (trong `pnpm validate`) | Sửa rule (2026-07-20) |
| `.claude/rules/auth.md` vẽ guard `authClient.getSession().catch(...)` inline trong `beforeLoad` | Code đã tiến hóa: `_authenticated/route.tsx` dùng `context.queryClient.ensureQueryData(sessionQueryOptions(authClient))` đưa session vào router context; `_authenticated/_admin/route.tsx` dùng `requireRoles(["admin"])` từ `@repo/auth` (`packages/auth/src/guards.ts`) | Viết lại mục "Route bảo vệ" theo idiom 2 tầng, dẫn 2 file thật |
| `docs/ADD-NEW-PANEL.md` Bước 1 ví dụ `user: ac.newRole({})` | Object rỗng phá type variance của `admin({ roles })` bên BE. Code thật: `ac.newRole({ user: [], session: [] })` | Sửa ví dụ (kèm comment vì sao) |
| `apps/web/deploy/nginx.conf` CSP hardcode `connect-src 'self' https://api.example.com` | Domain example — deploy thật sẽ chặn fetch/SSE | Đổi thành placeholder `__API_ORIGIN__`; việc thay domain thật ghi vào `docs/HUMAN-TODO.md` (Cloudflare Pages không dùng file này) |

## 2. Lạc hậu ĐÃ BIẾT, KHÔNG sửa (đọc bù theo ngữ cảnh)

- Nhiều rule/skill còn trỏ path thời single-app (`src/features/...`) — đọc là
  `apps/web/src/features/...`. Sửa hàng loạt = diff khổng lồ không đáng, template primer đã cảnh báo.
- Skill `fw-bootstrap-monorepo` (từ bộ config FamilyWallet) mô tả monorepo bun workspaces —
  quyết định hiện tại là **2 repo độc lập** (xem CLAUDE.md). Phần checklist dọn demo của skill
  vẫn đúng và đã làm theo.

## 3. Deviation trong quá trình bootstrap (tự quyết — cần user xác nhận)

| Chỉ dẫn | Thực tế | Quyết định |
|---|---|---|
| "Giải nén config-familywallet-fe.zip vào root" | File zip đó không tồn tại. Bộ config duy nhất: `tai-lieu/skill/familywallet-project-config.zip` (chung, không tách BE/FE) | Overlay phần áp dụng cho FE: PROJECT-BRIEF, rules {security,stellar,code-style}, agents {ux-writer,security-reviewer,e2e-verifier}, skills fw-{passkey-auth,capacitor-mobile,guardian-presence,ai-night-watch,indexer-notify,bootstrap-monorepo}. BỎ soroban-auditor + fw-soroban-contracts + fw-will-vault (contract ở repo khác; will vault đã hủy). CLAUDE.md viết mới bản 2-repo, primer template giữ ở `docs/TEMPLATE-PRIMER-FE.md` |
| `node scripts/init-project.mjs` (2.2) | Script `die()` khi origin là remote template + mặc định reset git | Tạm rename `origin`→`template`, chạy `--no-git --no-install`, rename lại. Lịch sử + backup branch giữ nguyên |
| `git clean -fd` (2.1) | `.gitignore` bị xóa khỏi đĩa trước restore → clean lúc đó sẽ nuốt `.env`, `settings.local.json`, `node_modules` | `git restore .` TRƯỚC; sau restore dry-run cho thấy chỉ còn RESET-REPORT.md (giữ lại) → KHÔNG chạy clean -fd |
| `apps/web/.env` | Đã tồn tại (VITE_API_URL=http://localhost:3000 đúng) | Giữ, chỉ đổi `VITE_APP_NAME=FamilyWallet` |

## 4. Phát hiện thêm từ agent review (2026-07-20) — đã sửa

| Chỗ sai | Thực tế | Đã xử lý |
|---|---|---|
| `.claude/rules/security.md` viết "Cấm seed `S...` trong repo. **Pre-commit đã quét** `S[A-Z0-9]{55}`" | `.gitleaks.toml` **KHÔNG có rule nào** bắt seed Stellar — chỉ `useDefault` + rule `sepay-key` sót từ template. security-reviewer đã TEST: seed 56 ký tự lọt qua, gitleaks báo "no leaks found". Rule tự nạp vào context nói có hàng rào mà hàng rào không tồn tại | Thêm rule `stellar-secret-seed` (`\bS[A-Z2-7]{55}\b`) vào `.gitleaks.toml` **CẢ HAI repo**; test lại: bắt được, không false-positive trên file tracked |
| `apps/web/deploy/nginx.conf` CSP `script-src 'sha256-6/D1/ufP…'` | Hash **LỆCH** với inline FOUC script thật trong `index.html`. Hệ quả fail-closed (script theme bị chặn) nhưng dụ người sửa nhanh bằng `'unsafe-inline'` → mất sạch tác dụng chống XSS | Tính lại từ file thật → `sha256-81loPoXAH2d7v6xD+o+5CuQ/gzjTzt45bNHddccOcTs=` |
| Cả `nginx.conf` lẫn `docs/HARDENING.md` ngụ ý prod có security header | Deploy THẬT là Cloudflare Pages direct-upload (`wrangler pages deploy apps/web/dist`) — Cloudflare **KHÔNG đọc `nginx.conf`**, và repo **không có file `_headers`** → production chạy **không CSP, không frame-ancestors, không nosniff** | Thêm `apps/web/public/_headers` mang đúng bộ header sang Cloudflare (kèm cảnh báo giữ đồng bộ 2 nơi + không dùng `unsafe-inline`) |
| `apps/web/index.html` `<html lang="vi">` | `site.ts` + `lib/i18n.ts` đã đổi `defaultLocale: "en"` (sản phẩm toàn cầu) | Đổi `lang="en"` |
| 3 màn cảnh báo (`nightWatch.alert`, `guardian.approveWarning`, `block.alert`) | Không trả lời đủ 3 câu bắt buộc của rule ux-writer (chuyện gì · vì sao tôi quan tâm · tôi bấm gì) — thiếu hẳn hệ quả và hành động; `block.alert` tiêu đề "Có phải bạn không?" mở ra 2 lựa chọn, trái luật "veto = MỘT hành động" | Viết lại cả en+vi theo đề xuất ux-writer, thêm key CTA + `ScreenStub` render nút (`tone="alert"`); màn `block` chỉ 1 nút |

## 5. Fail-env đã gặp (KHÔNG phải lỗi code — đừng "sửa" bằng cách nới test)

| Hiện tượng | Nguyên nhân | Cách xử lý đã dùng |
|---|---|---|
| `pnpm test`: `@repo/core` báo "no tests / 2 errors" sau 60s dưới turbo | vitest worker timeout trên WSL2 `/mnt/d` (KI-5). Chạy trực tiếp `cd packages/core && pnpm test` → **2 file / 14 test PASS** | Ghi nhận là fail-env, verify thật ở CI. KHÔNG nới test |
| Playwright: `libnspr4.so: cannot open shared object file` | Máy dev thiếu system lib cho Chromium; `npx playwright install-deps` cần **sudo** (không có) — KI-2 | `apt-get download` 3 gói `.deb` → `dpkg-deb -x /tmp/pwlibs` → chạy với `LD_LIBRARY_PATH`. Vá MÔI TRƯỜNG, không đụng test |
