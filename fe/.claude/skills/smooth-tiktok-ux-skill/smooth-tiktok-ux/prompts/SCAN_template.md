# TEMPLATE — Prompt SCAN (điền chỗ {{...}} cho dự án mới)

> Phase SCAN (read-only). Audit độ mượt navigation + phân loại mutation. KHÔNG sửa/build/commit. Mọi kết luận kèm `path:line` + code thật; mục không có ghi "KHÔNG có".

## Bối cảnh
- Repo FE: `{{repo}}` ({{monorepo? N app: liệt kê}}). Stack: {{React ver}} + Vite + {{router}} + TanStack Query {{ver}} + {{state}}.
- BE: `{{đường dẫn}}`, {{Bun/Node}}/{{framework}}, port {{port}}. **CẤM đụng:** {{process/service khác không được touch}}.
- Deploy: {{Cloudflare Pages / khác}}.
- App có tiền không: {{có → liệt kê surface tiền / không}}.

## Checklist scan 6 tầng (làm cho MỌI app)
Với mỗi tầng ghi ✅/⚠️/❌ + `path:line`:
1. **Query cache:** `new QueryClient` ở đâu (dùng chung hay copy-paste)? `staleTime/gcTime`? `persistQueryClient`? `keepPreviousData`? → `rg "new QueryClient|persistQueryClient|keepPreviousData"`
2. **Prefetch on intent:** `prefetchQuery` + `onTouchStart/onMouseEnter` có không? Route lazy prefetch chunk? → `rg "prefetchQuery|onTouchStart|React.lazy"`
3. **Transition/skeleton:** `startTransition` (thường 0 hit)? Suspense fallback = skeleton hay spinner? → `rg "startTransition|Suspense|skeleton -i"`
4. **Keep-alive:** `Activity`/`react-activation`/`keepalive-for-react` (thường 0)? Shell layout persistent? Scroll restoration? React ver ≥19.2? → `rg "Activity|KeepAlive|ScrollRestoration"` + đọc react version thật
5. **SSE:** mount ở root hay component con? Last-Event-ID? BroadcastChannel/Web Locks? → `rg "EventSource|Last-Event-ID|BroadcastChannel|navigator.locks"`
6. **Virtual list:** feed/list dài ảo hoá chưa? `useInfiniteQuery` cursor thật hay offset? → `rg "react-virtual|useInfiniteQuery|nextCursor"`
+ Bundle: `manualChunks`? Config có import `.ts` từ package không (bug Cloudflare)? → `rg "from ['\"]@.*/" apps/*/vite.config.* apps/*/tailwind.config.*`

## Phân loại mutation (nếu sẽ làm optimistic)
`rg "useMutation|mutationFn"` → mỗi cái: query nó ảnh hưởng, có SSE echo không, phân loại ELIGIBLE / FORBIDDEN(tiền) / REVIEW.

## BE hỗ trợ FE mượt
- SSE replay Last-Event-ID? Pagination cursor hay offset (đếm bao nhiêu service mỗi loại)? Cache-Control/ETag trên GET public? Create endpoint trả entity hay chỉ `{success}`?

## Output
Bảng gap 6 tầng × N app + phân loại mutation + version lock (react/vite/router/query) + top 5 việc ROI cao nhất DỰA TRÊN BẰNG CHỨNG (không lý thuyết) + điểm đang copy-paste nên gom vào package chung. KHÔNG đề xuất code sửa.
