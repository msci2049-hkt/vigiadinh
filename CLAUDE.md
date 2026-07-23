# CLAUDE.md — family-wallet (monorepo gốc)

VíGiaĐình: ví Stellar mà gia đình khôi phục được — social recovery + thừa kế chia % +
AI người gác đêm + theo dõi kết nối người bảo hộ. Mainnet target, custody = smart account.

## Bản đồ 3 thư mục — git chung, build riêng, CẤM import chéo

```
be/         Backend  — Bun + Hono + Drizzle/Postgres + Dragonfly + BullMQ + Better Auth
            Mọi lệnh bằng bun. Đọc be/CLAUDE.md trước khi đụng.
fe/         Frontend — React 19 + Vite + TanStack + Tailwind 4 (pnpm 9 + Node ≥20, KHÔNG bun)
            Monorepo pnpm+Turbo NỘI BỘ (apps/web + packages/*). Đọc fe/CLAUDE.md.
contracts/  Soroban (Rust) — CHƯA CÓ, dựng ở PHA 2+ (soroban-sdk 27, build wasm32v1-none)
shared/     NGUỒN hợp đồng BE↔FE (enum trạng thái, intent state machine, reason codes)
```

## Luật monorepo (bất biến)

1. **Git chung, build riêng.** Một repo, một lịch sử; nhưng `be/` build bằng bun,
   `fe/` bằng pnpm, `contracts/` bằng stellar-cli. KHÔNG có workspaces ở root
   (`package.json` root CHỈ chứa script), KHÔNG `bun install` trong fe/, KHÔNG `pnpm i` trong be/.
2. **CẤM import chéo** giữa `be/`, `fe/`, `contracts/`. Hai bên nói chuyện CHỈ qua HTTP.
   Types/enum dùng chung đi qua `shared/` bằng copy có gác:
   - Sửa ở `shared/*.ts` → `bun run sync:contract` (copy sang
     `be/src/shared-contract/` + `fe/packages/core/src/contract/`) → `bun run check:contract`.
   - Bản copy có header AUTO-SYNC — sửa tay bản copy là sai quy trình, check sẽ đỏ.
   - Riêng access-control (BE `src/lib/access-control.ts` ↔ FE `packages/auth/src/access-control.ts`)
     vẫn theo cơ chế canonical-hash cũ trong `be/docs/CONTRACT-SYNC.md` (chạy trong validate 2 bên).
3. **Lockfile bất khả xâm phạm:** `be/bun.lock`, `fe/pnpm-lock.yaml` — chỉ lô nâng/gỡ dependency
   có chủ đích được đổi, và phải install + validate + test lại cả bên đó.
4. Wiring dev: FE `VITE_API_URL` == BE `BETTER_AUTH_URL` (= `http://localhost:3000`),
   origin FE ∈ `TRUSTED_ORIGINS` của BE. `.env` không được commit (xem `.gitignore`).

## Lệnh chuẩn từng bên

```bash
cd be && bun install --frozen-lockfile && bun run validate && bun test
cd fe && pnpm i --frozen-lockfile && pnpm validate && pnpm test && pnpm build   # honest build
bun run sync:contract && bun run check:contract    # từ root, sau khi sửa shared/
```

## Tài liệu điều phối

- `../CHECKLIST-BUILD-vigiadinh.md` — checklist build tổng (bảng resume ở cuối).
- `BUILD-LOG.md` — nhật ký pha đã xong, SHA, điểm resume.
- `docs/ROUTES.md` — nguồn sự thật route FE (từ PHA 1.5).
- Skill: `../.claude/skills/` (6 skill stellar/vi-*) + `.claude/` nội bộ mỗi bên.
