# CLAUDE.md — FamilyWallet Frontend (`stellar-fe-vite`)

Ví Stellar mà gia đình khôi phục được: social recovery + thừa kế chia % + AI người gác đêm +
theo dõi kết nối người bảo hộ. Sản phẩm TOÀN CẦU — **en mặc định + vi**, mọi chuỗi qua i18n key,
cấm hardcode chữ trong JSX, không nhắc tên nước/tiền tệ/app nhắn tin của riêng thị trường nào.

Đọc trước khi làm bất cứ việc gì: `docs/PROJECT-BRIEF.md` (dự án là gì, trạng thái, lỗ hổng đã biết)
→ rule khớp việc trong `.claude/rules/` → skill khớp việc trong `.claude/skills/`.
Nền template FE chi tiết (stack, honest build, guard 2 tầng, BUG/KI, deploy Cloudflare): `docs/TEMPLATE-PRIMER-FE.md`.

## Bản đồ dự án — monorepo `family-wallet` (git chung, build riêng)

```
family-wallet/
  fe/          ← THƯ MỤC NÀY — Frontend: React 19 + Vite 8 + TanStack + Tailwind 4 + shadcn
                  pnpm 9 + Node ≥20 (KHÔNG bun) · monorepo pnpm+Turbo NỘI BỘ (apps/web + packages/*)
  be/          Backend: Bun + Hono + Drizzle + Better Auth — http://localhost:3000
  contracts/   Soroban Rust — dựng ở PHA 2+ (nguồn cũ: vigiadinh-main, ngoài repo)
  shared/      NGUỒN hợp đồng BE↔FE (enum trạng thái, intent) — `bun run sync:contract` ở root
```

- FE và BE nói chuyện **chỉ qua HTTP** — CẤM import chéo giữa `fe/`/`be/` (luật CLAUDE.md root).
  Enum dùng chung: `shared/` (root) là nguồn → copy AUTO-SYNC vào `packages/core/src/contract/`
  (gác bằng `check:contract` root). Types/zod khác BE cần cho FE: BE `src/shared-contract/`
  là nguồn, đồng bộ theo `docs/CONTRACT-SYNC.md`. KHÔNG import code từ `be/`.
- `packages/auth/src/access-control.ts` phải **giống hệt** BE `src/lib/access-control.ts`.
  Thêm/sửa role = sửa CẢ HAI bên trong cùng một commit (kiểm bằng `contract:check`).
- Spec UI = `vigiadinh-mockup.html` (41 màn, 8 nhóm — **nhóm két di chúc ĐÃ HỦY**). Giữ nguyên 7 màn
  auth + admin panel sẵn có của template.

## Luật bất biến (chi tiết trong .claude/rules/)

1. Custody trên chuỗi — FE không bao giờ giữ/serialize private key; ký bằng passkey.
2. `pnpm build` (honest) là bằng chứng build DUY NHẤT — `vite build`/`turbo build` KHÔNG tính.
3. Thiếu `apps/web/.env` = TRANG TRẮNG không báo lỗi — mọi setup phải có `cp .env.example .env`.
4. i18n từ commit đầu: en (mặc định) + vi, mọi chuỗi qua key; chuỗi người dùng đi qua `ux-writer`;
   thuật ngữ nội bộ (guardian/threshold/timelock/veto/heartbeat) CẤM xuất hiện trong UI — dùng chữ
   người thường (xem PROJECT-BRIEF §5).
5. Trạng thái online người bảo hộ chỉ chủ ví thấy. 6. Risk score chỉ trì hoãn, không tự cancel.
7. Cấm `--force`/`--no-verify`; file ≤300 dòng, component ≤200; WSL e2e chậm = fail-env,
   KHÔNG được nới test — verify thật ở CI.

## Bản đồ màn hình THẬT (2026-07-20 — 39 màn khung + 7 auth + admin panel)

```
apps/web/src/app/routes/
  PUBLIC   /welcome /get-started /passkey        nhóm 1 — mở đầu
  PUBLIC   /recovery{,/find-wallet,/sent,        nhóm 5 — khôi phục (người mất máy CHƯA có
            /progress,/countdown,/done}          session → PHẢI public, đây là chủ ý)
  PUBLIC   / /login /sign-up /verify-email /forgot-password /reset-password /unauthorized
  _authenticated/
    setup/{,assistant,choose-guardians,invite,threshold,timelock,review,done}   nhóm 2
    wallet/{,send,receive,history} · guardians/{,$guardianId}                   nhóm 3
    night-watch/{,log,alert,resolve,waiting,guardian-view}                      nhóm 4
    guardian/{,approve,approve-warning,approved}                                nhóm 6
    block/{,confirm,done}                                                       nhóm 7
    inheritance/{,heartbeat,claim}                                              nhóm 8
    _admin/admin/{,users,sessions,settings}   admin panel sẵn có — GIỮ NGUYÊN
  components/screen-stub.tsx   placeholder chung (title/description/cta/tone="alert")
  locales/{en,vi}/fw.json      namespace fw — 91 key, KHỚP 2 bên
```

**Mọi màn là KHUNG, TRỪ `/passkey`** (PHA 2.3 — luồng thật: tạo passkey → smart account
→ đăng nhập SEP-45, xem `features/wallet/`). Các màn còn lại chỉ render title/description/CTA
từ i18n, chưa có logic; chi tiết giao diện chờ `vigiadinh-mockup.html` (**chưa có trong repo**).
3 màn cảnh báo (`night-watch/alert`, `guardian/approve-warning`, `block/`) đã qua ux-writer:
đủ 3 câu (chuyện gì · vì sao · bấm gì).

## Lệnh chuẩn (repo này — mọi thứ bằng pnpm, Node 20)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env    # BẮT BUỘC — thiếu là trang trắng
pnpm dev:web                              # http://localhost:5173
pnpm validate && pnpm build               # honest build
pnpm test && pnpm test:e2e
```

Wiring bắt buộc: `VITE_API_URL` == BE `BETTER_AUTH_URL` (= `http://localhost:3000`),
origin FE ∈ BE `TRUSTED_ORIGINS`. Capacitor = Phase 2 (sau gate P0-M1) — CHƯA cài.

## Skills (.claude/skills/ — đọc SKILL.md khớp việc TRƯỚC khi code)

| Việc | Skill |
|---|---|
| passkey, WebAuthn, navigator.credentials, rpId | fw-passkey-auth |
| màn hình trạng thái guardian, ping, nối máy mới | fw-guardian-presence |
| UI cảnh báo AI, copilot, banner đỏ | fw-ai-night-watch |
| thông báo, SEP-7 deep link, SSE domain events | fw-indexer-notify |
| build Android/iOS (Phase 2) | fw-capacitor-mobile |
| bootstrap/dọn template, wiring BE↔FE | fw-bootstrap-monorepo |

Ngoài ra: 20 skill template (new-feature, new-route, protect-route, consume-sse, add-i18n, …) vẫn nguyên giá trị.

## Agents (.claude/agents/)

`ux-writer` cho MỌI chuỗi người dùng · `security-reviewer` trước release + sau thay đổi auth ·
`e2e-verifier` thu bằng chứng trước demo.

## Bẫy hiện tại (chi tiết: `ERRORS.md` + `.claude/ERRORS.md` + docs/TEMPLATE-DEVIATIONS.md)

- Thiếu `.env` → trang trắng, e2e "element not found" hàng loạt (BUG-007).
- WSL2 `/mnt/d`: vitest/tsc/e2e chậm bất thường — fail-env, không phải lỗi code (KI-5).
- Route guard là UX, không phải security — BE re-check mọi API call.
- `routeTree.gen.ts` tự sinh, không sửa tay; plugin `tanstackRouter` trước `react()`.
- CSP `apps/web/deploy/nginx.conf` dùng placeholder `__API_ORIGIN__` — thay origin BE thật khi deploy
  (xem docs/HUMAN-TODO.md).

## Định nghĩa "xong"

Code chưa xong khi thiếu một trong: `pnpm validate` xanh · honest build xanh · test pass
(phân biệt pass/skip/fail-env) · chuỗi người dùng qua ux-writer · security-reviewer không còn P0.
