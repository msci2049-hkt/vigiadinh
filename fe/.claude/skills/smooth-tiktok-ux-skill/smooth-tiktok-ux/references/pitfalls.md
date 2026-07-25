# Cạm bẫy đã trả giá — ĐỌC TRƯỚC KHI CODE

Mỗi mục là bug THẬT đã dính trên production và fix đã kiểm chứng. Không phải lý thuyết.

## 1. `<Activity mode="hidden">` — video/audio VẪN PHÁT
DOM còn sống nên `<video autoPlay>` trong tab ẩn tiếp tục chạy nhạc nền. Mọi component media trong tab keep-alive phải:
```ts
useLayoutEffect(() => () => { videoRef.current?.pause() }, [])
```
Dùng `useLayoutEffect` (gắn với việc UI bị ẩn thị giác), không `useEffect`. Verify: `video.paused === true` khi chuyển tab.

## 2. `<Activity mode="hidden">` — `useQuery` KHÔNG fetch
Effects bị cleanup khi hidden → đừng kỳ vọng Activity pre-render/warm data cho tab chưa mở. Activity CHỈ giữ state + DOM + scroll. Warm data vẫn phải qua `prefetchQuery` (tầng 2).

## 3. Vite config import raw `.ts` từ workspace package → Cloudflare chết
`import { x } from '@cdhc/core/vite'` mà export trỏ vào `.ts` thô: Vite externalize import config → runtime host `import()` thẳng `.ts`. **Node (Cloudflare Pages) không nạp `.ts` → `ERR_UNKNOWN_FILE_EXTENSION`.** Fix: preset config viết dạng `.mjs` (ESM JS thuần + `.d.ts`), export trỏ `.mjs`. Hoặc inline vào từng config. **Quy tắc: file config host-loaded (vite/tailwind/postcss) chỉ import `.js`/`.mjs`, không bao giờ `.ts`.**

## 4. Gate build false green — Bun VÀ Node ≥23.6 đều nói dối
Build xanh local KHÔNG chứng minh gì cho Cloudflare (Node 20). Bun transpile `.ts`, Node ≥23.6 strip types mặc định → cả hai nạp được `.ts` config → xanh giả. Gate honest:
```bash
NODE_OPTIONS=--no-experimental-strip-types npx turbo run build --force
```
Kèm `node --version` trong log. **Nghịch lý:** bump Cloudflare lên Node ≥22 để dọn EOL sẽ CHE lại bug này (strip types) — nên giữ guard tĩnh độc lập, đừng dựa vào runtime che.

## 5. SSE `id:` wall-clock poison lastEventId
Event không qua replay buffer mà vẫn set `id: Date.now()` → client lưu id rác đó, reconnect gửi lại → BE không XRANGE đúng, replay hỏng. Fix: event ngoài buffer (connected/heartbeat/system) BỎ HẲN `id:`. Chỉ event trong buffer mới có id (= stream id thật).

## 6. postgres-js không serialize `Date` trong raw sql template
`sql\`... ${dateObj} ...\`` → `TypeError ERR_INVALID_ARG_TYPE` (bytes.js). Fix: truyền ISO string + cast `::timestamptz`/`::uuid` trong SQL. Lỗi chỉ lộ khi chạy thật, không phải type-check.

## 7. Cursor giả + virtual list = item nhảy/trùng
`nextCursor: cursor + limit` là offset đội lốt cursor. Infinite scroll + data đổi giữa các trang → trùng/sót item. Fix cursor keyset THẬT `(sort_col, id)` TRƯỚC khi ảo hoá. Chứng minh bằng curl 3 trang liên tiếp: 0 overlap + legacy numeric ≡ keyset (equivalence).

## 8. Optimistic thiếu `cancelQueries` → refetch clobber rollback
onMutate không `await cancelQueries` trước snapshot → refetch đang bay ghi đè cả optimistic lẫn bản rollback. Luôn cancel trước khi setQueryData.

## 9. Optimistic tap nhanh thiếu `isMutating` guard → drift số đếm
onSettled invalidate ngay khi còn mutation khác cùng key đang bay → flicker/rollback-war. Guard: chỉ invalidate khi `isMutating(key) <= 1`.

## 10. Chat optimistic thiếu `clientMsgId` → tin nhắn double
Optimistic append + SSE echo về = 2 bubble. Bắt buộc `clientMsgId` (uuid) để reconcile: nhận tin thật thì SWAP temp, không append.

## 11. Persist làm lộ data cũ / đóng băng temp
Persist blocklist (blacklist) dễ quên → dùng ALLOWLIST opt-in `meta.persist`. Và loại item optimistic temp khỏi dehydrate (id `temp-`).

## 12. Skeleton đặt sai package → tàng hình (Tailwind)
Monorepo: skeleton dùng class Tailwind, nếu đặt ở package mà `content` globs của app KHÔNG scan → class không generate → skeleton trống trơn. Đặt ở package được scan (thường `packages/ui`), verify token màu có trong mọi app.

## 13. Zustand update trong startTransition xung đột
Navigation state cập nhật Zustand bên trong `startTransition` có thể race với concurrent render. Giữ navigation-critical state NGOÀI transition.

## 14. gcTime < maxAge → cache persist bị vứt ngay
`persistQueryClient` maxAge 24h nhưng gcTime mặc định 5' → cache hydrate xong bị garbage-collect tức thì, persist vô dụng. Luôn `gcTime >= maxAge`.

## 15. Tối ưu dead code
Trước khi ảo hoá/tối ưu một trang: grep routes xác nhận nó ĐƯỢC route. Từng phí công tối ưu `CommunityShopPage` unrouted. Đọc bằng chứng trước, đừng tin tên file.

---
**Meta-lesson:** mọi báo cáo "đã xong/đã xanh" phải kèm BẰNG CHỨNG THÔ (raw curl, node --version, grep output), không phải lời khẳng định. Agent được phép và NÊN cãi lại prompt khi bằng chứng mâu thuẫn — ghi lý do vào checklist.
