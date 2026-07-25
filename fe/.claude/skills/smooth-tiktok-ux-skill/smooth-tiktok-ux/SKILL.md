---
name: smooth-tiktok-ux
description: Xây app web/Capacitor MƯỢT NHƯ TIKTOK từ số 0 đến production — chuyển tab tức thì (秒开), mở lại app không màn trắng, bấm nút phản hồi ngay (optimistic UI), feed video lướt mượt, SSE realtime không double. Đúc kết từ triển khai production thật trên Turborepo 6 app (React 19 + Vite + TanStack Query 5 + RR7 + Bun/Hono BE), gồm TOÀN BỘ bug đã trả giá + fix đã kiểm chứng. Dùng khi: làm app/tính năng cần cảm giác native (tab bar, social feed, chat, shop); tối ưu SPA bị khựng/nháy trắng/spinner/refetch; thêm optimistic UI cho like/comment/chat/cart; xây video feed kiểu TikTok; fix lỗi deploy Cloudflare Pages liên quan config/monorepo; hoặc user nói bất kỳ từ nào: mượt, smooth, 秒开, TikTok-like, instant, keep-alive, prefetch, optimistic, skeleton, virtual list, tab không reload, app cảm giác native. Kể cả khi user chỉ nói "app tao bị chậm/giật/nháy" — dùng skill này để chẩn đoán đúng tầng.
---

# Smooth TikTok UX — App mượt như TikTok

Skill này chưng cất quy trình đã chạy thật trên production (CDHC — Turborepo 6 app, React 19.2 + Vite 7 + RR7 + TanStack Query 5 + Zustand, BE Bun/Hono/Drizzle/Postgres/Dragonfly, deploy Cloudflare Pages) thành công thức tái áp dụng cho dự án mới. Mọi cạm bẫy trong đây đều là bug THẬT đã dính và fix, không phải lý thuyết.

## Tư duy gốc — đọc trước khi làm

"Mượt như TikTok" = **2 việc khác nhau**, đừng trộn:

1. **Giảm độ trễ thật** (smooth navigation): hết refetch khi quay lại tab, hết remount, hết nháy trắng. → `references/smooth-nav.md`
2. **Giấu độ trễ còn lại** (optimistic UI): server round-trip không xoá được thì đừng cho user thấy — bấm là đổi UI ngay, server chạy nền. → `references/optimistic-ui.md`

Làm (1) trước (2). Và trước khi làm gì: **ĐO** — tab đã ghé bao nhiêu ms, tab lần đầu bao nhiêu, cold reopen có trắng không. Không đo = làm mù.

Nếu app có video feed dọc kiểu TikTok → thêm `references/video-feed.md` (HLS, CDN, player).

## Quy trình chuẩn (pattern scan → fix, ĐÃ kiểm chứng)

**Không bao giờ fix mù.** Luôn 2 phase:

1. **SCAN (read-only):** audit codebase theo checklist 6 tầng, mọi kết luận kèm `path:line` + code thật. Mục không có ghi rõ "KHÔNG có". Không sửa gì. → dùng `prompts/SCAN_template.md`
2. **FIX:** implement theo thứ tự ROI dựa trên bằng chứng scan, tự tạo checklist, commit từng work-package, gate xanh mới push. → dùng `prompts/FIX_template.md`

Agent được phép **cãi lại prompt khi bằng chứng mâu thuẫn** (vd: đừng ảo hoá dead code; đừng xoá scroll-hack nếu tabs chung scroll container) — ghi rõ lý do trong checklist.

## 6 tầng smooth navigation (thứ tự ROI, chi tiết trong references/smooth-nav.md)

| # | Tầng | Fix lõi | ROI |
|---|------|---------|-----|
| 1 | Query cache | `staleTime` + `gcTime` + `persistQueryClient` allowlist `meta.persist` | Cao nhất — hết refetch + hết màn trắng cold-open |
| 2 | Prefetch on intent | chunk `import()` + `prefetchQuery` trên `onTouchStart`/`onMouseEnter` | Cao — tab lần đầu cũng nhanh |
| 3 | Transition + skeleton | `startTransition` quanh navigate + skeleton thay spinner | Hết nháy trắng |
| 4 | Keep-alive | React 19.2 `<Activity>` cho 4–5 tab bottom bar (LRU) | "Chất TikTok" — tab switch < 16ms |
| 5 | SSE hardening | 1 connection root + Web Locks leader + Last-Event-ID replay | Realtime bền, N tab = 1 connection |
| 6 | Virtual list | `@tanstack/react-virtual` cho feed/chat dài + cursor THẬT | Mượt trên Android yếu |

## Lằn ranh cứng — TIỀN (áp cho MỌI dự án)

- **KHÔNG persist** query wallet/balance/order/finance → allowlist opt-in `meta: { persist: true }` chỉ cho data public an toàn (categories, news, config). Quên allowlist = mất persist (vô hại). Quên blocklist = lộ số dư cũ (nguy hiểm).
- **KHÔNG optimistic** trên mutation tiền/không-đảo-được (thanh toán, withdraw, blockchain). Like sai 200ms hoàn tác được; số dư sai 200ms thì không.
- **KHÔNG cache header** (`Cache-Control`/`ETag`) trên endpoint per-user/tiền — chỉ GET public thuần.

## Gate verification — bài học đắt nhất, KHÔNG được bỏ

**Build xanh trên Bun hoặc Node ≥23.6 KHÔNG chứng minh được gì cho Cloudflare Pages (Node 20).** Cả hai đều nạp được `.ts` thô (Bun transpile, Node mới strip types) → false green. Gate build honest:

```bash
node --version   # ghi vào log làm bằng chứng
NODE_OPTIONS=--no-experimental-strip-types npx turbo run build --force
```

Chi tiết toàn bộ gate (typecheck, biome, smoke, regression tiền, QA tay) → `references/verification.md`.

## Cạm bẫy đã trả giá (đọc references/pitfalls.md TRƯỚC khi code)

13+ bug thật, nổi bật:
- `<Activity>` hidden: video **VẪN PHÁT** (cần pause guard) + `useQuery` **KHÔNG fetch** (effects bị cleanup).
- Vite config import raw `.ts` từ workspace package → Cloudflare chết `ERR_UNKNOWN_FILE_EXTENSION`.
- SSE `id:` bằng wall-clock → poison `lastEventId` client.
- postgres-js không serialize `Date` trong raw sql template.
- Cursor giả (offset đội lốt) + virtual list = item nhảy/trùng — fix cursor thật TRƯỚC khi ảo hoá.
- Optimistic thiếu `cancelQueries` → refetch clobber rollback; tap nhanh thiếu `isMutating` guard → drift.
- Chat optimistic thiếu `clientMsgId` dedupe → tin nhắn double khi SSE echo.

## Files trong skill

| File | Khi nào đọc |
|------|-------------|
| `references/smooth-nav.md` | Làm/audit 6 tầng navigation — code mẫu đầy đủ |
| `references/optimistic-ui.md` | Thêm optimistic cho like/comment/chat/cart — 2 helper chuẩn + SSE dedupe |
| `references/video-feed.md` | App có video feed: HLS/CDN/player/preload |
| `references/pitfalls.md` | TRƯỚC khi code bất kỳ tầng nào — 13+ bug thật |
| `references/verification.md` | Trước khi push — gates + QA tay checklist |
| `prompts/SCAN_template.md` | Sinh prompt scan cho dự án mới |
| `prompts/FIX_template.md` | Sinh prompt fix sau khi có scan report |

## Áp cho dự án mới — Day-1 checklist

1. Scan bằng `prompts/SCAN_template.md` (điền tên repo/app/stack) → có báo cáo gap 6 tầng kèm bằng chứng.
2. Chốt với user: push main hay PR? App có tiền không (→ lằn ranh)? React ≥19.2 chưa (→ `<Activity>` native hay `keepalive-for-react`)?
3. Fix theo `prompts/FIX_template.md`, thứ tự ROI, gom code dùng chung vào package chung nếu monorepo.
4. Gate honest (Node no-strip) → push → watch deploy TẤT CẢ app xanh → QA tay 5 mục un-automatable → mới xoá branch.
5. Optimistic UI làm sprint riêng sau khi navigation ổn.
