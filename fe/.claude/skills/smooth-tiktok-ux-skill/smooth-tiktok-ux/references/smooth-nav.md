# Smooth Navigation — 6 tầng chi tiết (code đã chạy production)

Stack tham chiếu: React 19.2 + Vite 7 + React Router 7 + TanStack Query 5 + Zustand. Monorepo thì gom mọi thứ dưới đây vào `packages/core` dùng chung — sửa 1 lần lời N app.

## Tầng 1 — Query cache: hết refetch + hết màn trắng cold-open

### 1a. QueryClient factory dùng chung

```ts
// packages/core/src/query/create-query-client.ts
import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,        // quay lại tab trong 5' = cache instant, không refetch
        gcTime: 24 * 60 * 60_000,     // BẮT BUỘC ≥ maxAge persist, không thì cache hydrate bị VỨT
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export const persistOptions = {
  persister: createSyncStoragePersister({ storage: window.localStorage }),
  maxAge: 24 * 60 * 60_000,
  buster: __APP_VERSION__,   // define trong vite config — deploy mới TỰ phá cache cũ
  dehydrateOptions: {
    // ALLOWLIST opt-in — an toàn tiền: quên allowlist chỉ mất persist,
    // quên blocklist là lộ số dư cũ.
    shouldDehydrateQuery: (q) =>
      defaultShouldDehydrateQuery(q) && q.meta?.persist === true,
  },
}
```

Dùng: `<PersistQueryClientProvider client={qc} persistOptions={persistOptions}>`.

Gắn `meta: { persist: true }` CHỈ cho: categories, config public, news list, danh sách farm/địa điểm public. CẤM: wallet, balance, orders, withdraw, finance, bất kỳ per-user nhạy cảm.

localStorage giới hạn ~5MB — allowlist ít query là đủ, chưa cần IndexedDB.

### 1b. keepPreviousData cho pagination

```ts
import { keepPreviousData } from '@tanstack/react-query'
useQuery({ queryKey: ['products', page], queryFn, placeholderData: keepPreviousData })
```
→ đổi trang giữ data cũ hiển thị trong lúc fetch trang mới, KHÔNG nháy trắng. Áp cho mọi list phân trang bounded (≤20–50 item/trang). List bounded KHÔNG cần virtual list — keepPreviousData là fix đúng.

## Tầng 2 — Prefetch on intent

```tsx
// packages/core/src/navigation/create-tab-prefetcher.ts (rút gọn)
export function createTabPrefetcher(tabs: Record<string, {
  chunk: () => Promise<unknown>                    // import() của lazy page
  data?: (qc: QueryClient) => Promise<unknown>     // prefetchQuery đúng queryKey
}>) {
  const done = new Set<string>()
  return {
    prefetch(to: string, qc: QueryClient) {
      if (done.has(to)) return
      done.add(to)
      tabs[to]?.chunk()
      tabs[to]?.data?.(qc)
    },
    preloadAllOnIdle(qc: QueryClient) {
      requestIdleCallback(() => Object.keys(tabs).forEach(t => this.prefetch(t, qc)))
    },
  }
}
```

Bind trên nav item:
```tsx
<NavLink to={to}
  onTouchStart={() => prefetcher.prefetch(to, qc)}   // mobile: sớm hơn click 80–150ms — VÀNG cho Capacitor
  onMouseEnter={() => prefetcher.prefetch(to, qc)}   // desktop
  onFocus={() => prefetcher.prefetch(to, qc)}
/>
```
+ Card-level: prefetch detail (product/article) trên `onTouchStart` của card.
+ Gọi `preloadAllOnIdle` trong layout sau first paint.

## Tầng 3 — Transition + skeleton

RR7 mặc định ĐÃ bọc navigation trong `React.startTransition` nội bộ — hook riêng chủ yếu để lấy `isPending` cho progress bar:

```ts
export function useSmoothNavigate() {
  const navigate = useNavigate()
  const [isPending, startTransition] = useTransition()
  return { navigate: (to: string) => startTransition(() => navigate(to)), isPending }
}
```
⚠️ Zustand update trong transition có thể xung đột — giữ navigation state NGOÀI transition.

Suspense fallback: skeleton khớp layout (header strip + hero + cards, `animate-pulse`), KHÔNG dùng spinner tròn — skeleton làm não user tưởng đã load xong. Monorepo + Tailwind: đặt skeleton ở package mà tailwind content globs của các app CÓ scan (bug thật: đặt sai package → class không generate → skeleton tàng hình).

## Tầng 4 — Keep-alive với React 19.2 `<Activity>` (native)

Kiểm trước: `typeof React.Activity === 'symbol'` (cần react ≥19.2). Dưới 19.2 → dùng `keepalive-for-react` (maintain tốt hơn `react-activation`), ghi nợ kỹ thuật nâng cấp sau.

```tsx
// packages/core/src/navigation/KeepAliveOutlet.tsx (rút gọn — bản đầy đủ có LRU max 5)
'use no memo'  // React Compiler opt-out: mutate cache Map trong render là chủ đích
import { Activity } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

export function KeepAliveOutlet({ keepPaths }: { keepPaths: string[] }) {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const cache = useRef(new Map<string, ReactNode>())
  const keep = keepPaths.includes(pathname)
  if (keep && !cache.current.has(pathname)) cache.current.set(pathname, outlet)
  // LRU: quá 5 entry → evict cũ nhất
  return (
    <>
      {[...cache.current.entries()].map(([path, node]) => (
        <Activity key={path} mode={path === pathname ? 'visible' : 'hidden'}>{node}</Activity>
      ))}
      {!keep && outlet}
    </>
  )
}
```

Quy tắc:
- CHỈ keep 4–5 tab bottom bar chính. App admin/desktop KHÔNG cần. Keep tràn lan = phình RAM (~2× baseline là trần chấp nhận).
- `<Activity>` hidden = display:none + effects CLEANED UP + state giữ nguyên + render ưu tiên thấp.
- **2 bẫy chết người** → xem pitfalls.md mục 1–2 (video vẫn phát; useQuery không fetch khi hidden).
- Scroll: nếu mỗi tab scroll container RIÊNG → Activity tự giữ scroll. Nếu các tab CHUNG 1 container (layout có header scroll-away) → Activity KHÔNG giữ được, cần Map lưu scrollTop theo pathname (save on leave / restore on enter trong useLayoutEffect). Kiểm cấu trúc layout TRƯỚC khi quyết.

## Tầng 5 — SSE hardening

### FE: 1 connection + leader election đa-tab

- Mount SSE ở **app root** (provider bọc App), KHÔNG trong route/component con → chuyển tab không tear-down.
- Đa browser tab: chỉ 1 tab (leader) mở SSE, phát cho tab khác:

```ts
// Leader election qua Web Locks (queue tự promote khi leader đóng)
navigator.locks?.request('app-sse-notify', async () => {
  const es = openSSE()
  const bc = new BroadcastChannel('app-notify')
  es.onmessage = (e) => { handle(e); bc.postMessage(e.data) }
  await new Promise(() => {})   // giữ lock tới khi tab đóng — browser tự release → tab khác promote
})
// Follower: chỉ nghe BroadcastChannel, KHÔNG mở SSE
// Fallback: không có Web Locks (webview cũ) → per-tab như thường
```

- Capacitor native: EventSource không gắn được Bearer header → dùng `@microsoft/fetch-event-source`.
- Resume: EventSource + fetch-event-source TỰ gửi `Last-Event-ID` khi auto-reconnect — FE không cần code thêm, MIỄN LÀ BE set `id:` đúng (xem dưới).
- Chat SSE để per-tab (mỗi tab cần realtime riêng); chỉ dedupe notification SSE.

### BE: replay buffer (Hono + Dragonfly/Redis, pattern đã chạy production)

- Mỗi event qua broadcaster: `XADD sse:buf:{kênh}:{userId} MAXLEN ~200` (TTL ~300s), lấy stream id làm `id:` của SSE event.
- Khi client connect với header `Last-Event-ID` → `XRANGE (exclusive` replay event bị rơi.
- **Event KHÔNG qua buffer (connected, heartbeat, system) → BỎ HẲN `id:`.** Fallback `id: Date.now()` sẽ POISON lastEventId client (bug thật — xem pitfalls).
- Đa-process: pub/sub Dragonfly fan-out như thường, XADD trước publish.

## Tầng 6 — Virtual list + cursor thật

**Thứ tự bắt buộc: cursor thật TRƯỚC, ảo hoá SAU.** Cursor giả (offset đội lốt `nextCursor: cursor + limit`) + infinite scroll = item nhảy/trùng khi data đổi giữa các trang.

- BE: keyset pagination trên `(sort_col, id)` — cursor encode base64 `{s: sortVal, id}`. Giữ param `page` cũ song song để không breaking.
- FE: `useInfiniteQuery({ initialPageParam: null, getNextPageParam: (last) => last.nextCursor })`.
- Ảo hoá: `@tanstack/react-virtual` — feed dọc fullscreen: `estimateSize = container.clientHeight`, `overscan: 1–2`, `getItemKey = item.id`, fetch-more khi virtual item cuối render (bỏ sentinel IntersectionObserver).
- KHÔNG ảo hoá: list bounded ≤20–50/trang (keepPreviousData là đủ), dead code (kiểm route trước khi tối ưu!).

## Tầng phụ — Bundle

- `manualChunks` tách vendor (react, router, tanstack, ui-lib, form, date) → cache CDN bền qua deploy.
- Monorepo: preset dùng chung — NHƯNG file config chỉ được import `.mjs`/`.js`, TUYỆT ĐỐI không `.ts` thô (xem pitfalls mục 7 — bug chết Cloudflare).

## Đo (trước và sau)

- Tab đã keep-alive: **< 16ms** (1 frame). Tab đã cache data: **< 100ms**, 0 spinner.
- Cold reopen: shell + data persist hiện ngay, không màn trắng.
- Cách đo: React DevTools Profiler + `performance.now()` quanh navigate + Chrome Performance với CPU throttle 4× (giả lập Android yếu).
